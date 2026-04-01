const SEVERITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

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

    if (severity === "critical") {
      return sum + 25;
    }
    if (severity === "high") {
      return sum + 15;
    }
    if (severity === "medium") {
      return sum + 8;
    }

    return sum + 4;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
};
