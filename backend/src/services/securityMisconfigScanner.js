const getLineNumber = (text, index) => {
  if (typeof index !== "number" || index < 0) {
    return undefined;
  }

  return text.slice(0, index).split("\n").length;
};

const collectRegexIssues = (text, rules) => {
  const issues = [];

  for (const rule of rules) {
    let match;

    while ((match = rule.pattern.exec(text)) !== null) {
      issues.push({
        title: rule.title,
        category: "misconfig",
        severity: rule.severity,
        description: rule.description,
        line: getLineNumber(text, match.index),
      });

      if (!rule.pattern.global) {
        break;
      }
    }

    rule.pattern.lastIndex = 0;
  }

  return issues;
};

export const scanSecurityMisconfig = (text) => {
  const rules = [
    {
      pattern: /0\.0\.0\.0\/0/g,
      title: "Open network access",
      severity: "high",
      description: "Public CIDR block detected; verify least-privilege network rules.",
    },
    {
      pattern: /\bssl\s*[:=]\s*false\b/gi,
      title: "SSL disabled",
      severity: "medium",
      description: "Transport encryption appears disabled.",
    },
    {
      pattern: /CORS_ORIGIN\s*[:=]\s*["']\*["']/gi,
      title: "Wildcard CORS origin",
      severity: "medium",
      description: "Wildcard CORS origin can expose APIs to untrusted clients.",
    },
  ];

  return collectRegexIssues(text, rules);
};
