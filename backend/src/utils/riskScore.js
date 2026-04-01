const SEVERITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SECRET_SIGNAL_REGEX = /hardcoded\s+secret|access\s+key|private\s+key|api[_\s-]?key|token|password/i;

const getSeverityValue = (severity) => {
  const key = String(severity || "").toLowerCase();
  return SEVERITY_ORDER[key] || 1;
};

export const sortIssuesBySeverity = (issues) => {
  return [...issues].sort(
    (a, b) => getSeverityValue(b.severity) - getSeverityValue(a.severity)
  );
};

export const calculateScore = (issues) => {
  if (!issues.length) {
    return 100;
  }

  const penalty = issues.reduce((sum, issue) => {
    const severity = String(issue.severity || "low").toLowerCase();
    const title = String(issue.title || "");
    const isSecretSignal = SECRET_SIGNAL_REGEX.test(title);
    let issuePenalty = 0;

    if (severity === "critical") {
      issuePenalty += 28;
    } else if (severity === "high") {
      issuePenalty += 18;
    } else if (severity === "medium") {
      issuePenalty += 10;
    } else {
      issuePenalty += 5;
    }

    if (isSecretSignal) {
      issuePenalty += 14;
    }

    return sum + issuePenalty;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
};
