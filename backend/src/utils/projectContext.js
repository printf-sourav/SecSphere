const DOMAIN_RULES = [
  {
    domain: "banking",
    aliases: ["fintech", "finance", "payments"],
    impact: "high",
    keywords: [
      "payment",
      "transaction",
      "ledger",
      "account",
      "bank",
      "swift",
      "kyc",
      "fraud",
      "card",
    ],
  },
  {
    domain: "e-commerce",
    aliases: ["ecommerce", "retail", "shopping"],
    impact: "high",
    keywords: [
      "checkout",
      "cart",
      "order",
      "inventory",
      "product",
      "merchant",
      "payment",
      "shipping",
      "refund",
    ],
  },
  {
    domain: "healthcare",
    aliases: ["health-care", "medtech"],
    impact: "high",
    keywords: ["patient", "clinical", "ehr", "hipaa", "medical", "diagnosis", "hospital"],
  },
  {
    domain: "file-management",
    aliases: ["file management", "document-management", "document management", "storage"],
    impact: "medium",
    keywords: [
      "file",
      "folder",
      "document",
      "storage",
      "upload",
      "download",
      "directory",
      "bucket",
      "drive",
    ],
  },
  {
    domain: "saas",
    impact: "medium",
    keywords: ["tenant", "subscription", "workspace", "billing", "api", "auth", "dashboard"],
  },
  {
    domain: "generic",
    impact: "medium",
    keywords: [],
  },
];

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const normalizeProjectType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const normalizeDeclaredType = (declaredProjectType) => {
  const value = normalizeProjectType(declaredProjectType);
  if (!value) {
    return null;
  }

  const matched = DOMAIN_RULES.find(
    (rule) =>
      rule.domain === value ||
      (Array.isArray(rule.aliases) &&
        rule.aliases.map((alias) => normalizeProjectType(alias)).includes(value))
  );

  if (matched) {
    return {
      domain: matched.domain,
      impact: matched.impact,
      confidence: 1,
      rationale: "Project type provided by user input.",
    };
  }

  // Preserve user-provided custom domains instead of overriding with weak heuristics.
  return {
    domain: value,
    impact: "medium",
    confidence: 1,
    rationale: "Custom project type provided by user input.",
  };
};

export const inferProjectContext = ({
  repoUrl,
  filePaths,
  sampleText,
  declaredProjectType,
} = {}) => {
  const explicitMatch = normalizeDeclaredType(declaredProjectType);
  if (explicitMatch) {
    return explicitMatch;
  }

  const corpus = [
    String(repoUrl || ""),
    ...(Array.isArray(filePaths) ? filePaths.slice(0, 250) : []),
    String(sampleText || "").slice(0, 5000),
  ].join(" ");

  const tokenSet = new Set(tokenize(corpus));
  if (!tokenSet.size) {
    return {
      domain: "generic",
      impact: "medium",
      confidence: 0.3,
      rationale: "No strong domain signal found in project metadata.",
    };
  }

  let bestScore = 0;
  let bestCandidates = [];

  for (const rule of DOMAIN_RULES) {
    if (rule.domain === "generic") {
      continue;
    }

    const matches = rule.keywords.filter((keyword) => tokenSet.has(keyword));
    if (matches.length > bestScore) {
      bestScore = matches.length;
      bestCandidates = [{ rule, matches }];
    } else if (matches.length === bestScore && matches.length > 0) {
      bestCandidates.push({ rule, matches });
    }
  }

  // Require stronger confidence than a single keyword to avoid false domain picks.
  if (bestScore < 2 || bestCandidates.length !== 1) {
    const ambiguousReason = bestScore < 2
      ? "No strong domain signal found in project metadata."
      : "Multiple domains matched with similar confidence; defaulted to generic.";

    return {
      domain: "generic",
      impact: "medium",
      confidence: 0.35,
      rationale: ambiguousReason,
    };
  }

  const bestRule = bestCandidates[0].rule;
  const bestMatches = bestCandidates[0].matches;
  const confidence = Number(Math.min(0.95, 0.35 + bestScore * 0.12).toFixed(2));
  return {
    domain: bestRule.domain,
    impact: bestRule.impact,
    confidence,
    rationale: `Matched context keywords: ${bestMatches.join(", ")}.`,
  };
};
