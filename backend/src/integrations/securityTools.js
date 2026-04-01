import path from "path";
import { spawn } from "child_process";

const DEFAULT_SEMGREP_TIMEOUT_MS = Number(process.env.SEMGREP_TIMEOUT_MS || 30000);
const DEFAULT_TRIVY_TIMEOUT_MS = Number(process.env.TRIVY_TIMEOUT_MS || 120000);
const TRIVY_RETRY_TIMEOUT_MS = Number(process.env.TRIVY_RETRY_TIMEOUT_MS || 240000);
const TRIVY_INTERNAL_TIMEOUT = String(process.env.TRIVY_INTERNAL_TIMEOUT || "4m");
const TRIVY_RETRY_INTERNAL_TIMEOUT = String(
  process.env.TRIVY_RETRY_INTERNAL_TIMEOUT || "8m"
);
const TRIVY_SKIP_DIRS = String(
  process.env.TRIVY_SKIP_DIRS ||
    "node_modules,.git,dist,build,coverage"
)
  .split(",")
  .map((dir) => dir.trim())
  .filter(Boolean);
const MAX_TOOL_ISSUES = Number(process.env.MAX_TOOL_ISSUES || 50);
const MAX_STDOUT_BYTES = 5 * 1024 * 1024;

const runCli = (command, args, timeoutMs) => {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ stdout, stderr, timedOut: true, exitCode: null });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_STDOUT_BYTES) {
        stdout += chunk.toString();
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);

      if (error.code === "ENOENT") {
        finish({ stdout, stderr, missing: true, exitCode: null });
        return;
      }

      finish({ stdout, stderr, error: error.message, exitCode: null });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      finish({ stdout, stderr, exitCode: code });
    });
  });
};

const toRelativePath = (filePath, basePath) => {
  if (!filePath) {
    return "unknown";
  }

  if (!basePath) {
    return path.basename(filePath);
  }

  if (path.isAbsolute(filePath)) {
    const relative = path.relative(basePath, filePath);
    return relative || path.basename(filePath);
  }

  return filePath;
};

const normalizeSemgrepSeverity = (severity) => {
  const value = String(severity || "").toLowerCase();

  if (value === "critical") {
    return "critical";
  }
  if (value === "error" || value === "high") {
    return "high";
  }
  if (value === "warning" || value === "medium") {
    return "medium";
  }

  return "low";
};

const normalizeTrivySeverity = (severity) => {
  const value = String(severity || "").toLowerCase();

  if (value === "critical") {
    return "critical";
  }
  if (value === "high") {
    return "high";
  }
  if (value === "medium") {
    return "medium";
  }

  return "low";
};

const getTrivyArgs = (targetPath, internalTimeout) => {
  const skipArgs = TRIVY_SKIP_DIRS.flatMap((dir) => ["--skip-dirs", dir]);

  return [
    "fs",
    "--scanners",
    "vuln",
    "--format",
    "json",
    "--quiet",
    "--timeout",
    internalTimeout,
    ...skipArgs,
    targetPath,
  ];
};

const parseTrivyIssues = (stdout, basePath) => {
  if (!stdout?.trim()) {
    return {
      issues: [],
      error: null,
      empty: true,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      issues: [],
      error: "Trivy returned invalid JSON",
      empty: false,
    };
  }

  const results = Array.isArray(parsed?.Results) ? parsed.Results : [];
  const issues = [];

  for (const item of results) {
    const vulnerabilities = Array.isArray(item?.Vulnerabilities)
      ? item.Vulnerabilities
      : [];

    for (const vulnerability of vulnerabilities) {
      if (issues.length >= MAX_TOOL_ISSUES) {
        break;
      }

      const packageName = vulnerability?.PkgName || "dependency";
      const vulnerabilityId = vulnerability?.VulnerabilityID || "Unknown vulnerability";

      issues.push({
        title: `${vulnerabilityId} in ${packageName}`,
        category: "dependency",
        severity: normalizeTrivySeverity(vulnerability?.Severity),
        description:
          vulnerability?.Title ||
          vulnerability?.Description ||
          "Dependency vulnerability detected by Trivy.",
        line: undefined,
        file: toRelativePath(item?.Target, basePath),
      });
    }

    if (issues.length >= MAX_TOOL_ISSUES) {
      break;
    }
  }

  return {
    issues,
    error: null,
    empty: false,
  };
};

export const runSemgrepScan = async (targetPath, options = {}) => {
  const basePath = options.basePath;

  const result = await runCli(
    "semgrep",
    ["--config", "auto", "--json", targetPath],
    DEFAULT_SEMGREP_TIMEOUT_MS
  );

  if (result.missing) {
    return {
      issues: [],
      status: "skipped",
      reason: "Semgrep CLI not installed",
    };
  }

  if (result.timedOut) {
    return {
      issues: [],
      status: "skipped",
      reason: "Semgrep scan timed out",
    };
  }

  if (!result.stdout?.trim()) {
    return {
      issues: [],
      status: "skipped",
      reason: "Semgrep returned no JSON output",
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return {
      issues: [],
      status: "skipped",
      reason: "Semgrep returned invalid JSON",
    };
  }

  const findings = Array.isArray(parsed?.results) ? parsed.results : [];

  const issues = findings.slice(0, MAX_TOOL_ISSUES).map((finding) => ({
    title:
      finding?.extra?.message || finding?.check_id || "Semgrep security finding",
    category: "semgrep",
    severity: normalizeSemgrepSeverity(finding?.extra?.severity),
    description: finding?.extra?.message || "Semgrep security finding detected.",
    line: finding?.start?.line,
    file: toRelativePath(finding?.path, basePath),
  }));

  return {
    issues,
    status: "ok",
    reason: null,
  };
};

export const runTrivyDependencyScan = async (targetPath, options = {}) => {
  const basePath = options.basePath;

  const result = await runCli(
    "trivy",
    getTrivyArgs(targetPath, TRIVY_INTERNAL_TIMEOUT),
    DEFAULT_TRIVY_TIMEOUT_MS
  );

  if (result.missing) {
    return {
      issues: [],
      status: "skipped",
      reason: "Trivy CLI not installed",
    };
  }

  if (result.timedOut) {
    const retryResult = await runCli(
      "trivy",
      getTrivyArgs(targetPath, TRIVY_RETRY_INTERNAL_TIMEOUT),
      TRIVY_RETRY_TIMEOUT_MS
    );

    if (retryResult.missing) {
      return {
        issues: [],
        status: "skipped",
        reason: "Trivy CLI not installed",
      };
    }

    if (retryResult.timedOut) {
      return {
        issues: [],
        status: "skipped",
        reason: `Trivy scan timed out after retry (${DEFAULT_TRIVY_TIMEOUT_MS}ms + ${TRIVY_RETRY_TIMEOUT_MS}ms)`,
      };
    }

    const parsedRetry = parseTrivyIssues(retryResult.stdout, basePath);
    if (parsedRetry.error) {
      return {
        issues: [],
        status: "skipped",
        reason: parsedRetry.error,
      };
    }

    if (parsedRetry.empty) {
      if (retryResult.exitCode === 0 || !retryResult.stderr?.trim()) {
        return {
          issues: [],
          status: "ok",
          reason: null,
        };
      }

      const retryError = retryResult.stderr?.trim()
        ? `Trivy produced no JSON output: ${retryResult.stderr.trim()}`
        : "Trivy returned no JSON output";

      return {
        issues: [],
        status: "skipped",
        reason: retryError,
      };
    }

    return {
      issues: parsedRetry.issues,
      status: "ok",
      reason: null,
    };
  }

  const parsedResult = parseTrivyIssues(result.stdout, basePath);
  if (parsedResult.error) {
    return {
      issues: [],
      status: "skipped",
      reason: parsedResult.error,
    };
  }

  if (parsedResult.empty) {
    if (result.exitCode === 0 || !result.stderr?.trim()) {
      return {
        issues: [],
        status: "ok",
        reason: null,
      };
    }

    const noOutputError = result.stderr?.trim()
      ? `Trivy produced no JSON output: ${result.stderr.trim()}`
      : "Trivy returned no JSON output";

    return {
      issues: [],
      status: "skipped",
      reason: noOutputError,
    };
  }

  return {
    issues: parsedResult.issues,
    status: "ok",
    reason: null,
  };
};
