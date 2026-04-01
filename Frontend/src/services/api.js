const rawBase = import.meta.env.VITE_API_BASE_URL || '/api';
const API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

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

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Scan failed (${res.status})`);
  }

  return json.data;
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
export async function applyFixToCodebase({ vulnerability, fix, file, relativeFilePath } = {}) {
  const res = await fetch(`${API_BASE}/fix/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vulnerability,
      fix,
      file: file || relativeFilePath,
      relativeFilePath: relativeFilePath || file,
    }),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Auto-fix failed (${res.status})`);
  }

  return json.data;
}
