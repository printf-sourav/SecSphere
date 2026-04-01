import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  bedrockClient,
  bedrockModelId,
  bedrockTimeoutMs,
} from "../config/awsConfig.js";

const EXPLANATION_FALLBACK_RULES = [
  {
    pattern: /cross-site\s+scripting|\bxss\b|innerhtml|dangerouslysetinnerhtml|document\.write/i,
    explanation:
      "Unsanitized user-controlled content can be rendered in the browser and execute attacker scripts.",
    fix: "Never write raw user input to HTML sinks. Use safe text rendering APIs, sanitize rich content, and enforce CSP headers.",
  },
  {
    pattern: /insecure\s+network\s+usage|http:\/\//i,
    explanation:
      "Unencrypted HTTP traffic can expose credentials and sensitive data to interception or tampering.",
    fix: "Use HTTPS endpoints only, enforce TLS in configuration, and reject insecure transport for authentication or sensitive operations.",
  },
  {
    pattern: /insecure\s+dependenc|dependency/i,
    explanation:
      "Unpinned or outdated dependencies can pull vulnerable versions and increase supply-chain risk.",
    fix: "Pin exact dependency versions, upgrade vulnerable packages to patched releases, and enforce dependency scanning in CI/CD.",
  },
  {
    pattern: /path\s+traversal|\.\.\//i,
    explanation:
      "Path traversal allows attackers to access files outside intended directories by manipulating path input.",
    fix: "Normalize and sanitize file paths, use basename/allowlisted paths, and restrict all file operations to a fixed trusted directory.",
  },
  {
    pattern: /insecure\s+file\s+handling|file\s+upload|file\s+type\s+spoofing/i,
    explanation:
      "Unsafe file handling can allow malicious uploads or unintended file reads/writes.",
    fix: "Validate file type and extension, sanitize filenames, store uploads outside executable paths, and block traversal patterns.",
  },
  {
    pattern: /missing\s+input\s+validation|req\.(body|query|params)|request\.(json|body|query|params)/i,
    explanation:
      "Using unvalidated input increases risk of injection, logic abuse, and runtime errors.",
    fix: "Apply strict schema validation (type, length, format), reject invalid input early, and encode data for its output context.",
  },
  {
    pattern: /improper\s+error\s+handling|return\s+str\(e\)|res\.json\(\s*\{\s*error/i,
    explanation:
      "Returning raw error details can leak internal implementation information to attackers.",
    fix: "Return sanitized user-facing error messages and log detailed stack traces only on the server side.",
  },
  {
    pattern: /sensitive\s+logging|console\.log\(|print\(/i,
    explanation:
      "Logging sensitive values can expose secrets through logs, monitoring systems, or support channels.",
    fix: "Mask or remove secrets from logs and enforce centralized log redaction for tokens, passwords, and keys.",
  },
  {
    pattern: /weak\s+cryptography|\bmd5\b|\bsha1\b/i,
    explanation:
      "Weak hashing algorithms are vulnerable to collision and brute-force attacks.",
    fix: "Use modern primitives such as bcrypt/argon2 for passwords and SHA-256+ or authenticated encryption for integrity/confidentiality.",
  },
  {
    pattern: /deserialization\s+vulnerabilit|pickle\.loads|yaml\.load/i,
    explanation:
      "Unsafe deserialization of untrusted data can lead to remote code execution.",
    fix: "Avoid unsafe deserializers for untrusted input, use safe parsing APIs, and strictly validate allowed data structures.",
  },
  {
    pattern: /missing\s+rate\s+limiting/i,
    explanation:
      "Missing rate limits can enable brute-force attacks, scraping, and service abuse.",
    fix: "Add route-level rate limiting and abuse controls with per-IP/per-account thresholds and backoff/lockout policies.",
  },
  {
    pattern: /broken\s+access\s+control|\/admin/i,
    explanation:
      "Insufficient authorization checks can expose privileged actions to unauthorized users.",
    fix: "Enforce authentication and role/permission checks on every protected route and deny by default.",
  },
  {
    pattern: /insecure\s+authentication\s+logic|password\s*==/i,
    explanation:
      "Weak authentication logic can allow account compromise through predictable or insecure checks.",
    fix: "Use secure password hashing, strong credential policies, and centralized authentication middleware with lockout/MFA support.",
  },
  {
    pattern: /hardcoded\s+debug|debug\s*=\s*true/i,
    explanation:
      "Debug mode in non-development environments can expose internals and sensitive runtime state.",
    fix: "Disable debug mode in production and gate verbose diagnostics behind secure internal-only controls.",
  },
  {
    pattern: /wildcard\s+cors\s+origin|cors[_\s-]?origin\s*[:=]\s*["']\*["']/i,
    explanation:
      "A wildcard CORS origin allows any website to call your API, which can expose authenticated endpoints to untrusted origins.",
    fix: "Restrict CORS to trusted origins only (for example specific domains) and avoid using '*' for production APIs.",
  },
  {
    pattern: /iam\s+wildcard\s+action|"action"\s*:\s*"\*"/i,
    explanation:
      "Wildcard IAM actions can grant broader permissions than intended, increasing blast radius if credentials are compromised.",
    fix: "Replace wildcard actions with least-privilege actions required by the workload and scope permissions by service.",
  },
  {
    pattern: /iam\s+wildcard\s+resource|"resource"\s*:\s*"\*"/i,
    explanation:
      "Wildcard IAM resources permit access across many assets, which can lead to privilege escalation and data exposure.",
    fix: "Scope IAM resources to specific ARNs and add conditions where possible to limit access context.",
  },
  {
    pattern: /administratoraccess/i,
    explanation:
      "Administrator-level policies provide full account access and should be tightly controlled to reduce takeover risk.",
    fix: "Remove broad admin policies from routine principals and use role-based least-privilege access with temporary elevation.",
  },
  {
    pattern: /open\s+network\s+access|0\.0\.0\.0\/0/i,
    explanation:
      "Public network exposure to all IPs increases the chance of unauthorized access and automated attacks.",
    fix: "Restrict inbound CIDRs to trusted ranges, expose only required ports, and prefer private networking paths.",
  },
  {
    pattern: /ssl\s+disabled/i,
    explanation:
      "Disabling SSL/TLS can expose data in transit to interception and tampering.",
    fix: "Enable TLS for all external and internal service communication and enforce secure protocol versions.",
  },
  {
    pattern: /unsafe\s+eval\s+usage|\beval\s*\(/i,
    explanation:
      "Using eval can execute untrusted input as code, which may lead to remote code execution.",
    fix: "Remove eval usage and replace it with safer parsing or explicit control-flow logic over validated input.",
  },
  {
    pattern: /dynamic\s+function\s+constructor\s+usage|new\s+function\s*\(/i,
    explanation:
      "Dynamic function construction can introduce code injection risks when input is not strictly controlled.",
    fix: "Avoid new Function for runtime code generation and use predefined functions with validated parameters instead.",
  },
  {
    pattern: /potential\s+command\s+execution|child_process\.(exec|execsync|spawn)\s*\(/i,
    explanation:
      "Shell command execution can be abused for command injection if any part of the command derives from user input.",
    fix: "Use allowlisted commands, pass arguments safely without shell interpolation, and sanitize all external input.",
  },
  {
    pattern: /hardcoded\s+secret|possible\s+hardcoded\s+secret|access\s+key|private\s+key/i,
    explanation:
      "Embedded secrets in source or config can be leaked through repositories, logs, or build artifacts.",
    fix: "Move secrets to a secret manager or environment variables, rotate compromised values, and block secret commits in CI.",
  },
  {
    pattern: /path\s+traversal|directory\s+traversal|zip\s+slip/i,
    explanation:
      "Unvalidated file paths can let an attacker escape intended directories and read or overwrite sensitive files.",
    fix: "Normalize untrusted paths with path.resolve, reject absolute paths and '..' segments, and verify the resolved path stays within a fixed allowlisted base directory.",
  },
  {
    pattern: /path\.?join/i,
    explanation:
      "User-influenced path construction can lead to path traversal and unauthorized file system access.",
    fix: "Normalize and validate path segments against an allowlist, reject traversal patterns, and enforce a fixed base directory.",
  },
  {
    pattern: /sensitive\s+file\s+explicitly\s+included/i,
    explanation:
      "Re-including sensitive files in version control can expose credentials and cryptographic material.",
    fix: "Remove sensitive files from tracked history, update ignore rules, and rotate any exposed secrets immediately.",
  },
];

const toContextLine = (projectContext = {}) => {
  const domain = projectContext?.domain || "generic";
  const confidence = Number(projectContext?.confidence || 0);
  return `Project context: domain=${domain}, confidence=${confidence}`;
};

const toIssueContextLine = (issue = {}) => {
  if (!issue || typeof issue !== "object") {
    return "";
  }

  const file = issue?.file || "unknown";
  const line = issue?.line || "n/a";
  const severity = String(issue?.severity || "low").toLowerCase();
  const category = issue?.category || "unknown";

  return `Issue context: severity=${severity}, category=${category}, file=${file}, line=${line}`;
};

const toLearnedExamplesText = (learnedExamples = []) => {
  if (!Array.isArray(learnedExamples) || !learnedExamples.length) {
    return "";
  }

  return learnedExamples
    .slice(0, 3)
    .map(
      (item, index) =>
        `${index + 1}. vuln=${item.vulnerability} | fix=${item.fix} | source=${item.source || "learned"}`
    )
    .join("\n");
};

const getFallbackSummary = (issues) => {
  if (!issues.length) {
    return "No vulnerabilities were detected in the scanned input.";
  }

  const severityCounts = issues.reduce(
    (acc, issue) => {
      const key = String(issue.severity || "low").toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  return `${issues.length} issues found: ${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low. Prioritize high-impact fixes first.`;
};

const parseJsonObject = (text) => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
};

const invokeBedrock = async (prompt, maxTokens = 250) => {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: bedrockModelId,
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Bedrock request timeout"));
    }, bedrockTimeoutMs);
  });

  const response = await Promise.race([bedrockClient.send(command), timeoutPromise]);
  clearTimeout(timeoutId);

  const raw = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed?.content)) {
    return parsed.content
      .map((item) => item?.text || "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
};

const getRuleBasedFallback = (title, learnedExamples = []) => {
  const safeTitle = String(title || "Unknown issue");

  const matchedRule = EXPLANATION_FALLBACK_RULES.find((rule) =>
    rule.pattern.test(safeTitle)
  );

  if (matchedRule) {
    return {
      explanation: matchedRule.explanation,
      fix: matchedRule.fix,
    };
  }

  if (learnedExamples[0]?.fix) {
    return {
      explanation:
        "A previously validated remediation pattern was applied for a similar issue to keep guidance consistent and practical.",
      fix: String(learnedExamples[0].fix),
    };
  }

  return {
    explanation:
      "This issue can increase security risk if left unresolved. Apply a least-privilege, input-validation, and secure-configuration approach based on the affected component.",
    fix:
      "Review the affected file, remove broad permissions or unsafe constructs, validate untrusted input, and apply environment-specific hardening before deployment.",
  };
};

export const explainIssue = async (title, options = {}) => {
  const safeTitle = String(title || "Unknown issue");
  const projectContext = options?.projectContext || {};
  const learnedExamples = Array.isArray(options?.learnedExamples)
    ? options.learnedExamples
    : [];
  const issue = options?.issue || {};

  const learnedExamplesText = toLearnedExamplesText(learnedExamples);
  const issueContextLine = toIssueContextLine(issue);

  const prompt = [
    "You are a cloud security expert.",
    "Given a vulnerability title, return only valid JSON with keys: explanation, fix.",
    "Keep explanation to 1-2 sentences and fix to actionable secure code guidance.",
    "Do not use generic templates. Mention the specific vulnerability and mitigation for the affected context.",
    "Tailor impact based on project context when available.",
    toContextLine(projectContext),
    issueContextLine,
    learnedExamplesText ? "Reference learned fix examples below when relevant:" : "",
    learnedExamplesText,
    `Title: ${safeTitle}`,
  ].join("\n");

  try {
    const text = await invokeBedrock(prompt, 220);
    const parsed = parseJsonObject(text);

    if (parsed?.explanation && parsed?.fix) {
      return {
        explanation: String(parsed.explanation),
        fix: String(parsed.fix),
      };
    }

    return getRuleBasedFallback(safeTitle, learnedExamples);
  } catch {
    return getRuleBasedFallback(safeTitle, learnedExamples);
  }
};

export const generateSummary = async (issues, options = {}) => {
  if (!issues.length) {
    return "No vulnerabilities were detected in the scanned input.";
  }

  const projectContext = options?.projectContext || {};

  const issueLines = issues
    .slice(0, 30)
    .map(
      (issue) =>
        `- ${issue.title} | severity=${issue.severity || "low"} | file=${issue.file || "unknown"}`
    )
    .join("\n");

  const prompt = [
    "You are a cloud security expert.",
    "Write a concise executive security summary in 1-2 sentences.",
    "Focus on severity concentration and immediate remediation priority.",
    toContextLine(projectContext),
    `Issues (${issues.length}):`,
    issueLines,
  ].join("\n");

  try {
    const text = await invokeBedrock(prompt, 180);
    return text || getFallbackSummary(issues);
  } catch {
    return getFallbackSummary(issues);
  }
};

export const generateBestPractices = async (issues, options = {}) => {
  const projectContext = options?.projectContext || {};

  const issueTitles = (issues || [])
    .map((issue) => String(issue?.title || ""))
    .join("\n")
    .toLowerCase();

  const practices = [];

  if ((issues || []).some((issue) => ["critical", "high"].includes(String(issue?.severity || "").toLowerCase()))) {
    practices.push("Set a strict remediation SLA for critical/high findings and block risky deployments until fixed.");
  }

  if (/iam|administratoraccess|wildcard action|wildcard resource/.test(issueTitles)) {
    practices.push("Apply least-privilege IAM policies and avoid wildcard permissions for actions or resources.");
  }

  if (/0\.0\.0\.0\/0|open network|public/.test(issueTitles)) {
    practices.push("Restrict public network exposure and limit inbound CIDR ranges to trusted sources only.");
  }

  if (/secret|key|token|password/.test(issueTitles)) {
    practices.push("Move secrets to a managed secret store and enforce key rotation with short credential lifetimes.");
  }

  if (/dependency|cve|vulnerabilityid/.test(issueTitles)) {
    practices.push("Enable automated dependency scanning in CI and pin vulnerable packages to patched versions.");
  }

  practices.push("Add security scan gates to CI/CD so new vulnerabilities are detected before release.");

  const prompt = [
    "You are a security architect.",
    "Return only valid JSON object with key practices (string array, 3-5 concise bullet points).",
    "Recommendations must be practical and prioritized for developer teams.",
    toContextLine(projectContext),
    `Issues (${issues.length}):`,
    (issues || [])
      .slice(0, 20)
      .map((issue) => `- ${issue.title} | severity=${issue.severity || "low"}`)
      .join("\n"),
  ].join("\n");

  try {
    const text = await invokeBedrock(prompt, 220);
    const parsed = parseJsonObject(text);
    const fromAi = Array.isArray(parsed?.practices)
      ? parsed.practices.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    return [...new Set([...fromAi, ...practices])].slice(0, 5);
  } catch {
    return [...new Set(practices)].slice(0, 5);
  }
};
