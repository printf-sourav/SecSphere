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
        category: "code",
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

export const scanCode = (text) => {
  const rules = [
    {
      pattern: /\beval\s*\(/g,
      title: "Unsafe eval usage",
      severity: "high",
      description: "Avoid eval because it can execute untrusted input.",
    },
    {
      pattern: /\bnew\s+Function\s*\(/g,
      title: "Dynamic Function constructor usage",
      severity: "high",
      description: "Dynamic function creation can lead to code injection risks.",
    },
    {
      pattern: /child_process\.(exec|execSync|spawn)\s*\(/g,
      title: "Potential command execution",
      severity: "medium",
      description: "Shell command execution should be validated and sandboxed.",
    },
  ];

  return collectRegexIssues(text, rules);
};
