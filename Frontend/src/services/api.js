const rawBase = import.meta.env.VITE_API_BASE_URL || '/api';
const API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

const normalizeScanData = (data = {}) => {
  const fallbackResults = Array.isArray(data?.issues) ? data.issues : [];
  const baseResults = Array.isArray(data?.results) ? data.results : fallbackResults;

  const results = baseResults.map((item, index) => {
    const line = Number(item?.line);

    return {
      ...item,
      id: item?.id || `VULN-${String(index + 1).padStart(3, '0')}`,
      severity: String(item?.severity || 'low').toLowerCase(),
      file: item?.file || item?.location?.file || 'unknown',
      line: Number.isFinite(line) && line > 0 ? line : undefined,
    };
  });

  const score = Number(data?.score);
  const predictedScore = Number(data?.predictedScore);

  return {
    ...data,
    results,
    score: Number.isFinite(score) ? score : 0,
    predictedScore: Number.isFinite(predictedScore)
      ? predictedScore
      : (Number.isFinite(score) ? score : 0),
    riskBand: String(data?.riskBand || 'low').toLowerCase(),
    bestPractices: Array.isArray(data?.bestPractices) ? data.bestPractices : [],
    projectContext: data?.projectContext || {},
    scanSessionId: data?.scanSessionId || null,
  };
};

/**
 * Run a security scan.
 * Accepts either a file (File object) or a repo URL string, plus an optional projectType.
 * Returns the parsed JSON response from the backend.
 */
export async function runScan({ file, repoUrl, projectType } = {}) {
  let res;

  if (file) {
    const form = new FormData();
    form.append('file', file);
    if (repoUrl) form.append('repoUrl', repoUrl);
    if (projectType) form.append('projectType', projectType);

    res = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      body: form,
    });
  } else {
    res = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, projectType }),
    });
  }

  const json = await res.json();

  const payload = json?.data ?? json;
  const isFailure = (typeof json?.success === 'boolean' && !json.success) || !res.ok;

  if (isFailure) {
    throw new Error(json.message || `Scan failed (${res.status})`);
  }

  return normalizeScanData(payload);
}

/**
 * Submit fix feedback so the backend can learn from user-approved fixes.
 */
export async function submitFixFeedback({ vulnerability, fix, projectType, file, notes } = {}) {
  const res = await fetch(`${API_BASE}/feedback/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vulnerability, fix, projectType, file, notes }),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Feedback failed (${res.status})`);
  }

  return json.data;
}

/**
 * Apply selected fix directly to the project codebase via backend.
 */
export async function applyFixToCodebase({ vulnerability, fix, file, relativeFilePath, scanSessionId } = {}) {
  const res = await fetch(`${API_BASE}/fix/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vulnerability,
      fix,
      file: file || relativeFilePath,
      relativeFilePath: relativeFilePath || file,
      scanSessionId,
    }),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Auto-fix failed (${res.status})`);
  }

  return json.data;
}

export async function downloadFixedZipFromSession({ scanSessionId } = {}) {
  const res = await fetch(`${API_BASE}/fix/session/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanSessionId }),
  });

  if (!res.ok) {
    let message = `Download failed (${res.status})`;

    try {
      const json = await res.json();
      message = json?.message || message;
    } catch {
      // Ignore non-JSON error payload.
    }

    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const fileName = decodeURIComponent(match?.[1] || match?.[2] || 'fixed-project.zip');

  return {
    blob,
    fileName,
  };
}
