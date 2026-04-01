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
        category: "config",
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

export const scanConfig = (text) => {
  const rules = [
    {
      pattern: /AKIA[0-9A-Z]{16}/g,
      title: "Possible AWS access key",
      severity: "high",
      description: "Hardcoded cloud credentials detected.",
    },
    {
      pattern: /(password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*["'][^"']{4,}["']/gi,
      title: "Possible hardcoded secret",
      severity: "high",
      description: "Potential plaintext secret found in file content.",
    },
    {
      pattern: /private[_-]?key\s*[:=]/gi,
      title: "Possible private key material",
      severity: "high",
      description: "Potential private key reference found in configuration.",
    },
  ];

  return collectRegexIssues(text, rules);
};
