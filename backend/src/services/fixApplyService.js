import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { walkFiles } from "../utils/fileWalker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, "../../..");
const MAX_AUTO_FIX_FILE_BYTES = Number(process.env.MAX_AUTO_FIX_FILE_BYTES || 2 * 1024 * 1024);

const CODE_LIKE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
]);

const toPosixPath = (value) => String(value || "").replace(/\\/g, "/");

const normalizeRelativePath = (value) =>
  toPosixPath(value)
    .trim()
    .replace(/^\/+/, "")
    .replace(/^(\.\/)+/, "");

const isSafeRelativePath = (relativePath) => {
  if (!relativePath || relativePath.includes("\u0000")) {
    return false;
  }

  if (relativePath.startsWith("/") || /^[a-zA-Z]:\//.test(relativePath)) {
    return false;
  }

  const segments = relativePath.split("/").filter(Boolean);
  if (!segments.length) {
    return false;
  }

  return segments.every((segment) => segment !== "." && segment !== "..");
};

const isInsideRoot = (rootDir, targetPath) => {
  const relative = path.relative(rootDir, targetPath);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

const toEnvName = (value) =>
  String(value || "SECRET")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "SECRET";

const getProjectRoot = () => {
  const configured = String(process.env.AUTO_FIX_PROJECT_ROOT || "").trim();
  return configured ? path.resolve(configured) : DEFAULT_PROJECT_ROOT;
};

const resolveTargetFilePath = async (relativeFilePath, rootDir) => {
  const safeRelativePath = normalizeRelativePath(relativeFilePath);

  if (!isSafeRelativePath(safeRelativePath)) {
    return null;
  }

  const directPath = path.resolve(rootDir, safeRelativePath);
  if (isInsideRoot(rootDir, directPath) && (await fs.pathExists(directPath))) {
    return directPath;
  }

  const files = await walkFiles(rootDir, { maxFiles: 4000 });
  const wanted = safeRelativePath.toLowerCase();
  const wantedParts = wanted.split("/").filter(Boolean);

  // Fuzzy fallback is only allowed for a bare filename to avoid ambiguous nested-path targeting.
  if (wantedParts.length > 1) {
    return null;
  }

  const wantedBaseName = wantedParts[wantedParts.length - 1] || "";

  let bestMatch = null;
  let bestScore = -1;

  for (const filePath of files) {
    const projectRelative = toPosixPath(path.relative(rootDir, filePath)).toLowerCase();
    const projectParts = projectRelative.split("/").filter(Boolean);
    const projectBaseName = projectParts[projectParts.length - 1] || "";

    if (!projectBaseName || projectBaseName !== wantedBaseName) {
      continue;
    }

    let suffixScore = 0;
    for (let i = 1; i <= Math.min(projectParts.length, wantedParts.length); i += 1) {
      if (projectParts[projectParts.length - i] === wantedParts[wantedParts.length - i]) {
        suffixScore += 1;
      } else {
        break;
      }
    }

    if (projectRelative.endsWith(wanted)) {
      suffixScore += 50;
    }

    if (suffixScore > bestScore) {
      bestScore = suffixScore;
      bestMatch = filePath;
    }
  }

  if (bestMatch && isInsideRoot(rootDir, bestMatch)) {
    return bestMatch;
  }

  return null;
};

const applyHardcodedSecretFix = (content, extension) => {
  const regex = /(password|passwd|pwd|secret|api[_-]?key|token)\s*([:=])\s*["'][^"'\r\n]{4,}["']/gi;
  let changed = false;

  const updated = content.replace(regex, (fullMatch, key, separator) => {
    changed = true;
    const envName = toEnvName(key);

    if (separator === "=") {
      return `${key}=process.env.${envName}`;
    }

    if (CODE_LIKE_EXTENSIONS.has(extension)) {
      return `${key}: process.env.${envName}`;
    }

    return `${key}: null`;
  });

  return {
    changed,
    updated,
    strategy: changed ? "secret-env-migration" : null,
  };
};

const applyCorsWildcardFix = (content) => {
  const regex = /CORS_ORIGIN\s*([:=])\s*["']\*["']/gi;
  let changed = false;

  const updated = content.replace(regex, (fullMatch, separator) => {
    changed = true;

    if (separator === "=") {
      return "CORS_ORIGIN=http://localhost:5173";
    }

    return "CORS_ORIGIN: \"http://localhost:5173\"";
  });

  return {
    changed,
    updated,
    strategy: changed ? "cors-allowlist" : null,
  };
};

const DEFAULT_IAM_LEAST_PRIVILEGE_ACTIONS = ["s3:GetObject", "s3:PutObject"];
const DEFAULT_IAM_LEAST_PRIVILEGE_RESOURCES = ["arn:aws:s3:::example-bucket/*"];

const ensureStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim());
  }

  return [String(value || "").trim()];
};

const hasWildcardOrEmptyEntry = (value) =>
  ensureStringArray(value).some((item) => item === "*" || item === "");

const detectJsonIndent = (content) => {
  const match = content.match(/\n(\s+)"/);

  if (!match || !match[1]) {
    return 2;
  }

  return match[1].length;
};

const applyIamWildcardFixFromJson = (content) => {
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const statement = parsed?.Statement;
  const statements = Array.isArray(statement)
    ? statement
    : (statement && typeof statement === "object" ? [statement] : []);

  if (!statements.length) {
    return {
      changed: false,
      updated: content,
      strategy: null,
    };
  }

  let changed = false;

  for (const item of statements) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(item, "Action") && hasWildcardOrEmptyEntry(item.Action)) {
      item.Action = [...DEFAULT_IAM_LEAST_PRIVILEGE_ACTIONS];
      changed = true;
    }

    if (Object.prototype.hasOwnProperty.call(item, "Resource") && hasWildcardOrEmptyEntry(item.Resource)) {
      item.Resource = [...DEFAULT_IAM_LEAST_PRIVILEGE_RESOURCES];
      changed = true;
    }
  }

  if (!changed) {
    return {
      changed: false,
      updated: content,
      strategy: null,
    };
  }

  const indentation = detectJsonIndent(content);
  const updated = `${JSON.stringify(parsed, null, indentation)}${content.endsWith("\n") ? "\n" : ""}`;

  return {
    changed,
    updated,
    strategy: "iam-least-privilege-template",
  };
};

const applyIamWildcardFix = (content) => {
  const jsonResult = applyIamWildcardFixFromJson(content);

  if (jsonResult && jsonResult.changed) {
    return jsonResult;
  }

  let changed = false;
  let updated = content;

  const actionRegex = /"Action"\s*:\s*(?:"\*"|\[[^\]]*"\*"[^\]]*\])/g;
  const resourceRegex = /"Resource"\s*:\s*(?:"\*"|\[[^\]]*"\*"[^\]]*\])/g;

  if (actionRegex.test(updated)) {
    changed = true;
    updated = updated.replace(
      actionRegex,
      `"Action": ["${DEFAULT_IAM_LEAST_PRIVILEGE_ACTIONS[0]}", "${DEFAULT_IAM_LEAST_PRIVILEGE_ACTIONS[1]}"]`
    );
  }

  if (resourceRegex.test(updated)) {
    changed = true;
    updated = updated.replace(
      resourceRegex,
      `"Resource": ["${DEFAULT_IAM_LEAST_PRIVILEGE_RESOURCES[0]}"]`
    );
  }

  return {
    changed,
    updated,
    strategy: changed ? "iam-least-privilege-template" : null,
  };
};

const applyOpenNetworkFix = (content) => {
  const regex = /0\.0\.0\.0\/0/g;
  let changed = false;

  const updated = content.replace(regex, () => {
    changed = true;
    return "10.0.0.0/8";
  });

  return {
    changed,
    updated,
    strategy: changed ? "restrict-cidr-range" : null,
  };
};

const PY_PINNED_VERSIONS = {
  flask: "2.3.3",
  django: "4.2.16",
  requests: "2.32.3",
  fastapi: "0.115.0",
  pyyaml: "6.0.2",
  cryptography: "43.0.1",
};

const pinPythonDependencyLine = (line) => {
  const trimmed = String(line || "").trim();

  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-r ")) {
    return line;
  }

  if (/(==|>=|<=|~=|!=|>|<)/.test(trimmed)) {
    return line;
  }

  const match = trimmed.match(/^([a-zA-Z0-9_.-]+)/);
  if (!match) {
    return line;
  }

  const packageName = match[1];
  const version = PY_PINNED_VERSIONS[packageName.toLowerCase()] || "1.0.0";
  return `${packageName}==${version}`;
};

const applyInsecureDependenciesFix = (content, extension, targetPath) => {
  const fileName = path.basename(String(targetPath || "")).toLowerCase();

  if (fileName === "requirements.txt" || extension === ".txt") {
    const lines = String(content || "").split(/\r?\n/);
    let changed = false;

    const updatedLines = lines.map((line) => {
      const updatedLine = pinPythonDependencyLine(line);
      if (updatedLine !== line) {
        changed = true;
      }

      return updatedLine;
    });

    return {
      changed,
      updated: updatedLines.join("\n"),
      strategy: changed ? "pin-python-dependencies" : null,
    };
  }

  if (fileName === "package.json") {
    try {
      const parsed = JSON.parse(content);
      let changed = false;

      for (const section of ["dependencies", "devDependencies"]) {
        const deps = parsed?.[section];
        if (!deps || typeof deps !== "object") {
          continue;
        }

        for (const [name, version] of Object.entries(deps)) {
          const original = String(version || "");
          const pinned = original.replace(/^[\^~]/, "");
          if (pinned !== original) {
            deps[name] = pinned;
            changed = true;
          }
        }
      }

      return {
        changed,
        updated: changed ? `${JSON.stringify(parsed, null, 2)}\n` : content,
        strategy: changed ? "pin-node-dependencies" : null,
      };
    } catch {
      return {
        changed: false,
        updated: content,
        strategy: null,
      };
    }
  }

  return {
    changed: false,
    updated: content,
    strategy: null,
  };
};

const applyInsecureNetworkUsageFix = (content) => {
  const regex = /http:\/\//g;
  let changed = false;

  const updated = String(content || "").replace(regex, () => {
    changed = true;
    return "https://";
  });

  return {
    changed,
    updated,
    strategy: changed ? "enforce-https" : null,
  };
};

const applyFixHeuristic = ({ content, vulnerability, extension, targetPath }) => {
  const title = String(vulnerability || "").toLowerCase();

  if (/hardcoded\s+secret|possible\s+hardcoded\s+secret|access\s+key|private\s+key|token|password/.test(title)) {
    return applyHardcodedSecretFix(content, extension);
  }

  if (/wildcard\s+cors\s+origin|cors/.test(title)) {
    return applyCorsWildcardFix(content);
  }

  if (/iam\s+wildcard\s+action|iam\s+wildcard\s+resource|administratoraccess/.test(title)) {
    return applyIamWildcardFix(content);
  }

  if (/open\s+network\s+access|0\.0\.0\.0\/0/.test(title)) {
    return applyOpenNetworkFix(content);
  }

  if (/insecure\s+dependenc/.test(title)) {
    return applyInsecureDependenciesFix(content, extension, targetPath);
  }

  if (/insecure\s+network\s+usage/.test(title)) {
    return applyInsecureNetworkUsageFix(content);
  }

  return {
    changed: false,
    updated: content,
    strategy: null,
  };
};

export const applyFixToCodebase = async ({
  relativeFilePath,
  vulnerability,
  selectedFix,
  projectRoot,
} = {}) => {
  const rootDir = projectRoot ? path.resolve(projectRoot) : getProjectRoot();
  const safeRelativeFilePath = normalizeRelativePath(relativeFilePath);

  if (!isSafeRelativePath(safeRelativeFilePath)) {
    throw new Error("Invalid file path");
  }

  if (!String(vulnerability || "").trim()) {
    throw new Error("vulnerability is required");
  }

  if (!String(selectedFix || "").trim()) {
    throw new Error("fix is required");
  }

  const targetPath = await resolveTargetFilePath(safeRelativeFilePath, rootDir);
  if (!targetPath) {
    throw new Error("Target file not found in project root for auto-fix");
  }

  if (!isInsideRoot(rootDir, targetPath)) {
    throw new Error("Resolved target is outside allowed project root");
  }

  const fileStat = await fs.stat(targetPath);
  if (fileStat.size > MAX_AUTO_FIX_FILE_BYTES) {
    throw new Error("Target file is too large for auto-fix");
  }

  const original = await fs.readFile(targetPath, "utf8");
  const extension = path.extname(targetPath).toLowerCase();

  const patchResult = applyFixHeuristic({
    content: original,
    vulnerability,
    extension,
    targetPath,
  });

  if (!patchResult.changed || patchResult.updated === original) {
    throw new Error(
      "No safe automatic patch available for this finding. Choose another fix option or patch manually."
    );
  }

  const backupPath = `${targetPath}.bak.${Date.now()}`;
  await fs.writeFile(backupPath, original, "utf8");
  await fs.writeFile(targetPath, patchResult.updated, "utf8");

  const relativeUpdatedPath = toPosixPath(path.relative(rootDir, targetPath));
  const relativeBackupPath = toPosixPath(path.relative(rootDir, backupPath));

  return {
    updated: true,
    strategy: patchResult.strategy || "auto",
    file: relativeUpdatedPath,
    backupFile: relativeBackupPath,
    projectRoot: rootDir,
  };
};
