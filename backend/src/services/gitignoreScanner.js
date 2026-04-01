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
        category: "gitignore",
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

export const scanGitignore = (text) => {
  const rules = [
    {
      pattern: /^!.*\.(env|pem|key|p12)$/gim,
      title: "Sensitive file explicitly included",
      severity: "high",
      description:
        "Gitignore appears to re-include sensitive secret/certificate files.",
    },
    {
      pattern: /^#\s*TODO.*ignore/gi,
      title: "Incomplete ignore hardening",
      severity: "low",
      description: "TODO comments indicate gitignore hardening may be incomplete.",
    },
  ];

  return collectRegexIssues(text, rules);
};
