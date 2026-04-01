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
        category: "iam",
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

export const scanIAM = (text) => {
  const rules = [
    {
      pattern: /"Action"\s*:\s*"\*"/g,
      title: "IAM wildcard action",
      severity: "medium",
      description: "Wildcard IAM action may grant excessive privileges.",
    },
    {
      pattern: /"Resource"\s*:\s*"\*"/g,
      title: "IAM wildcard resource",
      severity: "medium",
      description: "Wildcard IAM resource may broaden access scope.",
    },
    {
      pattern: /AdministratorAccess/gi,
      title: "AdministratorAccess policy usage",
      severity: "high",
      description: "Administrator-level policies should be tightly controlled.",
    },
  ];

  return collectRegexIssues(text, rules);
};
