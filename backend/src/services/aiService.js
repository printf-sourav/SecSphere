import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  bedrockClient,
  bedrockModelId,
  bedrockTimeoutMs,
} from "../config/awsConfig.js";

const toContextLine = (projectContext = {}) => {
  const domain = projectContext?.domain || "generic";
  const confidence = Number(projectContext?.confidence || 0);
  return `Project context: domain=${domain}, confidence=${confidence}`;
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

export const explainIssue = async (title, options = {}) => {
  const safeTitle = String(title || "Unknown issue");
  const projectContext = options?.projectContext || {};
  const learnedExamples = Array.isArray(options?.learnedExamples)
    ? options.learnedExamples
    : [];

  const learnedExamplesText = toLearnedExamplesText(learnedExamples);

  const prompt = [
    "You are a cloud security expert.",
    "Given a vulnerability title, return only valid JSON with keys: explanation, fix.",
    "Keep explanation to 1-2 sentences and fix to actionable secure code guidance.",
    "Tailor impact based on project context when available.",
    toContextLine(projectContext),
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

    if (learnedExamples[0]?.fix) {
      return {
        explanation:
          "Similar vulnerabilities were resolved previously. Reusing a validated remediation pattern for consistency.",
        fix: String(learnedExamples[0].fix),
      };
    }

    return null;
  } catch {
    if (learnedExamples[0]?.fix) {
      return {
        explanation:
          "Bedrock response was unavailable, so the system applied a learned remediation pattern from prior accepted fixes.",
        fix: String(learnedExamples[0].fix),
      };
    }

    return null;
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
