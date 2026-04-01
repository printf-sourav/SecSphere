import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, "..", "data");
const learnedFixesFile = path.join(dataDir, "learned-fixes.json");
const patternDatasetFile = path.join(dataDir, "security-patterns.json");

const MAX_STORED_LEARNINGS = Number(process.env.MAX_STORED_LEARNINGS || 1000);

const normalizeText = (value) => String(value || "").trim();

const tokenize = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const toKeywordSet = (value) => new Set(tokenize(value));

const readJsonArray = async (filePath) => {
  try {
    const parsed = await fs.readJson(filePath);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ensureLearningFiles = async () => {
  await fs.ensureDir(dataDir);

  if (!(await fs.pathExists(learnedFixesFile))) {
    await fs.writeJson(learnedFixesFile, [], { spaces: 2 });
  }

  if (!(await fs.pathExists(patternDatasetFile))) {
    await fs.writeJson(patternDatasetFile, [], { spaces: 2 });
  }
};

const scoreExample = (example, title, projectType) => {
  const titleKeywords = toKeywordSet(title);
  const vulnKeywords = toKeywordSet(example.vulnerability);
  const keywordOverlap = [...titleKeywords].filter((key) => vulnKeywords.has(key)).length;
  const usageScore = Math.min(Number(example.usageCount || 0), 10) * 0.1;
  const projectBonus =
    projectType &&
    String(example.projectType || "").toLowerCase() === String(projectType).toLowerCase()
      ? 1
      : 0;

  return keywordOverlap + usageScore + projectBonus;
};

export const recordUserFixFeedback = async ({
  vulnerability,
  fix,
  projectType,
  file,
  notes,
} = {}) => {
  const safeVulnerability = normalizeText(vulnerability);
  const safeFix = normalizeText(fix);

  if (!safeVulnerability || !safeFix) {
    throw new Error("Both vulnerability and fix are required");
  }

  await ensureLearningFiles();
  const items = await readJsonArray(learnedFixesFile);

  const now = new Date().toISOString();
  const project = normalizeText(projectType) || "generic";

  const existingIndex = items.findIndex((item) => {
    const vulnMatch =
      normalizeText(item.vulnerability).toLowerCase() === safeVulnerability.toLowerCase();
    const fixMatch = normalizeText(item.fix).toLowerCase() === safeFix.toLowerCase();
    return vulnMatch && fixMatch;
  });

  let saved;
  if (existingIndex >= 0) {
    const current = items[existingIndex];
    saved = {
      ...current,
      usageCount: Number(current.usageCount || 0) + 1,
      lastAppliedAt: now,
      projectType: project,
      file: normalizeText(file) || current.file || "unknown",
      notes: normalizeText(notes) || current.notes || "",
      source: "user-learned",
    };
    items[existingIndex] = saved;
  } else {
    saved = {
      id: `fix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      vulnerability: safeVulnerability,
      fix: safeFix,
      projectType: project,
      file: normalizeText(file) || "unknown",
      notes: normalizeText(notes),
      usageCount: 1,
      firstAppliedAt: now,
      lastAppliedAt: now,
      source: "user-learned",
    };
    items.unshift(saved);
  }

  const trimmed = items.slice(0, MAX_STORED_LEARNINGS);
  await fs.writeJson(learnedFixesFile, trimmed, { spaces: 2 });

  return saved;
};

export const getLearnedFixExamples = async ({
  title,
  projectType,
  limit = 3,
} = {}) => {
  const safeTitle = normalizeText(title);
  if (!safeTitle) {
    return [];
  }

  await ensureLearningFiles();

  const learned = await readJsonArray(learnedFixesFile);
  const patterns = await readJsonArray(patternDatasetFile);

  const merged = [
    ...learned.map((item) => ({ ...item, source: item.source || "user-learned" })),
    ...patterns.map((item) => ({
      ...item,
      usageCount: Number(item.usageCount || 1),
      source: item.source || "pattern-dataset",
    })),
  ].filter((item) => normalizeText(item.vulnerability) && normalizeText(item.fix));

  const ranked = merged
    .map((item) => ({
      ...item,
      _score: scoreExample(item, safeTitle, projectType),
    }))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, Math.max(1, Number(limit || 3)))
    .map(({ _score, ...item }) => item);

  return ranked;
};
