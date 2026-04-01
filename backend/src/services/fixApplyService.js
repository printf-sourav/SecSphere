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

const applyPathTraversalFix = (content, extension) => {
  let changed = false;
  let updated = String(content || "");

  if (extension === ".py") {
    const replacedDotDot = updated.replace(/\.\.\//g, () => {
      changed = true;
      return "";
    });

    updated = replacedDotDot.replace(
      /(open\s*\(\s*["'][^"']*[\\/]?["']\s*\+\s*)([a-zA-Z_][a-zA-Z0-9_]*)/g,
      (full, prefix, variableName) => {
        changed = true;
        return `${prefix}os.path.basename(${variableName})`;
      }
    );

    return {
      changed,
      updated,
      strategy: changed ? "sanitize-path-input" : null,
    };
  }

  const replacedDotDot = updated.replace(/\.\.\//g, () => {
    changed = true;
    return "";
  });

  updated = replacedDotDot.replace(
    /((?:open|fs\.(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync|createWriteStream))\s*\(\s*["'][^"']*[\\/]?["']\s*\+\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    (full, prefix, variableName) => {
      changed = true;
      return `${prefix}path.basename(${variableName})`;
    }
  );

  return {
    changed,
    updated,
    strategy: changed ? "sanitize-path-input" : null,
  };
};

const applyInsecureFileHandlingFix = (content, extension) => {
  const traversalResult = applyPathTraversalFix(content, extension);
  if (traversalResult.changed) {
    return {
      ...traversalResult,
      strategy: "secure-file-path-handling",
    };
  }

  return traversalResult;
};

const prependHelperIfMissing = (content, marker, helperCode) => {
  const source = String(content || "");
  if (source.includes(marker)) {
    return {
      changed: false,
      updated: source,
    };
  }

  return {
    changed: true,
    updated: `${helperCode}\n\n${source}`,
  };
};

const applySensitiveDataExposureFix = (content, extension) => {
  const secretResult = applyHardcodedSecretFix(content, extension);
  if (secretResult.changed) {
    return {
      ...secretResult,
      strategy: "sensitive-data-hardening",
    };
  }

  return secretResult;
};

const applyInjectionVulnerabilityFix = (content, extension) => {
  if (!CODE_LIKE_EXTENSIONS.has(extension)) {
    return {
      changed: false,
      updated: String(content || ""),
      strategy: null,
    };
  }

  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/\beval\s*\(/g, () => {
    changed = true;
    return "SECSPHERE_BLOCKED_EVAL(";
  });

  updated = updated.replace(/new\s+Function\s*\(/g, () => {
    changed = true;
    return "SECSPHERE_BLOCKED_FUNCTION(";
  });

  updated = updated.replace(/child_process\.execSync\s*\(/g, () => {
    changed = true;
    return "child_process.execFileSync(";
  });

  updated = updated.replace(/child_process\.exec\s*\(/g, () => {
    changed = true;
    return "child_process.execFile(";
  });

  updated = updated.replace(/(SELECT\s+[^\n;]*?)\s*\+\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/gi, (full, sqlPrefix, variableName) => {
    changed = true;
    return `${sqlPrefix} ? /* SECSPHERE_PARAM:${variableName} */`;
  });

  if (changed) {
    const helperResult = prependHelperIfMissing(
      updated,
      "const SECSPHERE_BLOCKED_EVAL =",
      [
        "const SECSPHERE_BLOCKED_EVAL = () => {",
        "  throw new Error(\"Blocked insecure dynamic code execution\");",
        "};",
        "const SECSPHERE_BLOCKED_FUNCTION = () => {",
        "  throw new Error(\"Blocked insecure Function constructor usage\");",
        "};",
      ].join("\n")
    );

    return {
      changed: changed || helperResult.changed,
      updated: helperResult.updated,
      strategy: "injection-hardening",
    };
  }

  return {
    changed: false,
    updated,
    strategy: null,
  };
};

const applyXssFix = (content, extension) => {
  if (!CODE_LIKE_EXTENSIONS.has(extension)) {
    return {
      changed: false,
      updated: String(content || ""),
      strategy: null,
    };
  }

  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/\.innerHTML\s*=/g, () => {
    changed = true;
    return ".textContent =";
  });

  updated = updated.replace(/document\.write\s*\(/g, () => {
    changed = true;
    return "console.warn(\"Blocked document.write\", ";
  });

  updated = updated.replace(/dangerouslySetInnerHTML/g, () => {
    changed = true;
    return "data-secsphere-safe-html";
  });

  return {
    changed,
    updated,
    strategy: changed ? "xss-safe-rendering" : null,
  };
};

const applyMissingInputValidationFix = (content, extension) => {
  let changed = false;
  let updated = String(content || "");

  if (CODE_LIKE_EXTENSIONS.has(extension)) {
    updated = updated.replace(/\breq\.(body|query|params)\b/g, (full, scope, offset, source) => {
      const prefix = source.slice(Math.max(0, offset - 40), offset);
      if (/SECSPHERE_VALIDATE_INPUT\s*\($/.test(prefix)) {
        return full;
      }

      changed = true;
      return `SECSPHERE_VALIDATE_INPUT(req.${scope})`;
    });

    if (changed) {
      const helperResult = prependHelperIfMissing(
        updated,
        "const SECSPHERE_VALIDATE_INPUT =",
        [
          "const SECSPHERE_VALIDATE_INPUT = (value) => {",
          "  if (value === null || value === undefined) return value;",
          "  if (typeof value === \"string\") return value.replace(/[<>`$]/g, \"\");",
          "  if (Array.isArray(value)) return value.map((item) => SECSPHERE_VALIDATE_INPUT(item));",
          "  if (typeof value === \"object\") {",
          "    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECSPHERE_VALIDATE_INPUT(item)]));",
          "  }",
          "  return value;",
          "};",
        ].join("\n")
      );

      return {
        changed: changed || helperResult.changed,
        updated: helperResult.updated,
        strategy: "strict-input-validation",
      };
    }

    return {
      changed,
      updated,
      strategy: changed ? "strict-input-validation" : null,
    };
  }

  if (extension === ".py") {
    updated = updated.replace(/\brequest\.(json|args|form)\b/g, (full, scope, offset, source) => {
      const prefix = source.slice(Math.max(0, offset - 30), offset);
      if (/secsphere_validate_input\s*\($/.test(prefix)) {
        return full;
      }

      changed = true;
      return `secsphere_validate_input(request.${scope})`;
    });

    if (changed && !updated.includes("def secsphere_validate_input(")) {
      updated = [
        "def secsphere_validate_input(value):",
        "    if value is None:",
        "        return value",
        "    if isinstance(value, str):",
        "        return value.replace('<', '').replace('>', '').replace('`', '').replace('$', '')",
        "    if isinstance(value, list):",
        "        return [secsphere_validate_input(item) for item in value]",
        "    if isinstance(value, dict):",
        "        return {key: secsphere_validate_input(item) for key, item in value.items()}",
        "    return value",
        "",
        updated,
      ].join("\n");
    }

    return {
      changed,
      updated,
      strategy: changed ? "strict-input-validation" : null,
    };
  }

  return {
    changed,
    updated,
    strategy: changed ? "strict-input-validation" : null,
  };
};

const applyHardcodedDebugConfigFix = (content) => {
  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/debug\s*=\s*True/g, () => {
    changed = true;
    return "debug=False";
  });

  updated = updated.replace(/debug\s*=\s*true/gi, () => {
    changed = true;
    return "debug = false";
  });

  updated = updated.replace(/NODE_ENV\s*([:=])\s*["']development["']/gi, (full, separator) => {
    changed = true;
    if (separator === "=") {
      return "NODE_ENV=production";
    }

    return "NODE_ENV: \"production\"";
  });

  return {
    changed,
    updated,
    strategy: changed ? "disable-debug-mode" : null,
  };
};

const applyInsecureAuthenticationLogicFix = (content, extension) => {
  let changed = false;
  let updated = String(content || "");

  if (CODE_LIKE_EXTENSIONS.has(extension)) {
    updated = updated.replace(/(password|passwd|pwd)\s*==\s*([^\n;&|)]+)/gi, (full, left, right) => {
      changed = true;
      return `SECSPHERE_SAFE_EQUALS(${left}, ${right.trim()})`;
    });

    updated = updated.replace(/(password|passwd|pwd)\s*!=\s*([^\n;&|)]+)/gi, (full, left, right) => {
      changed = true;
      return `!SECSPHERE_SAFE_EQUALS(${left}, ${right.trim()})`;
    });

    if (changed) {
      const helperResult = prependHelperIfMissing(
        updated,
        "const SECSPHERE_SAFE_EQUALS =",
        [
          "const SECSPHERE_SAFE_EQUALS = (left, right) => {",
          "  return String(left ?? \"\") === String(right ?? \"\");",
          "};",
        ].join("\n")
      );

      return {
        changed: changed || helperResult.changed,
        updated: helperResult.updated,
        strategy: "secure-auth-comparison",
      };
    }
  }

  if (extension === ".py") {
    updated = updated.replace(/(password|passwd|pwd)\s*==\s*([^\n:&|)]+)/gi, (full, left, right) => {
      changed = true;
      return `secsphere_safe_equals(${left}, ${right.trim()})`;
    });

    if (changed && !updated.includes("def secsphere_safe_equals(")) {
      updated = [
        "def secsphere_safe_equals(left, right):",
        "    return str(left) == str(right)",
        "",
        updated,
      ].join("\n");
    }
  }

  return {
    changed,
    updated,
    strategy: changed ? "secure-auth-comparison" : null,
  };
};

const applyBrokenAccessControlFix = (content, extension) => {
  if (!CODE_LIKE_EXTENSIONS.has(extension)) {
    return {
      changed: false,
      updated: String(content || ""),
      strategy: null,
    };
  }

  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(
    /(\b(?:router|app)\.(?:get|post|put|delete)\(\s*["'`]\/?admin[^"'`]*["'`]\s*,\s*)(?!SECSPHERE_REQUIRE_AUTH\b)/gi,
    (full, prefix) => {
      changed = true;
      return `${prefix}SECSPHERE_REQUIRE_AUTH, `;
    }
  );

  if (changed) {
    const helperResult = prependHelperIfMissing(
      updated,
      "const SECSPHERE_REQUIRE_AUTH =",
      [
        "const SECSPHERE_REQUIRE_AUTH = (req, res, next) => {",
        "  if (!req.headers?.authorization) {",
        "    return res.status(401).json({ error: \"Unauthorized\" });",
        "  }",
        "  return next();",
        "};",
      ].join("\n")
    );

    return {
      changed: changed || helperResult.changed,
      updated: helperResult.updated,
      strategy: "access-control-middleware",
    };
  }

  return {
    changed,
    updated,
    strategy: changed ? "access-control-middleware" : null,
  };
};

const applySensitiveLoggingFix = (content) => {
  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/console\.log\s*\(([^)]*(password|token|secret)[^)]*)\)/gi, () => {
    changed = true;
    return 'console.log("[REDACTED_SENSITIVE_LOG]")';
  });

  updated = updated.replace(/logger\.(info|debug|error|warn)\s*\(([^)]*(password|token|secret)[^)]*)\)/gi, (full, level) => {
    changed = true;
    return `logger.${level}("[REDACTED_SENSITIVE_LOG]")`;
  });

  updated = updated.replace(/print\s*\(([^)]*(password|token|secret)[^)]*)\)/gi, () => {
    changed = true;
    return 'print("[REDACTED_SENSITIVE_LOG]")';
  });

  return {
    changed,
    updated,
    strategy: changed ? "sensitive-log-redaction" : null,
  };
};

const applyImproperErrorHandlingFix = (content) => {
  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/res\.status\([^)]*\)\.send\s*\(\s*err(?:or)?\s*\)/gi, () => {
    changed = true;
    return 'res.status(500).send("Internal Server Error")';
  });

  updated = updated.replace(/res\.json\s*\(\s*\{\s*error\s*:\s*err(?:or)?[^}]*\}\s*\)/gi, () => {
    changed = true;
    return 'res.json({ error: "Internal Server Error" })';
  });

  updated = updated.replace(/return\s+str\s*\(\s*e\s*\)/g, () => {
    changed = true;
    return 'return "Internal Server Error"';
  });

  return {
    changed,
    updated,
    strategy: changed ? "sanitized-error-response" : null,
  };
};

const applyDeserializationFix = (content, extension) => {
  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/yaml\.load\s*\(/g, () => {
    changed = true;
    return "yaml.safeLoad(";
  });

  updated = updated.replace(/pickle\.loads\s*\(/g, () => {
    changed = true;
    return "json.loads(";
  });

  updated = updated.replace(/JSON\.parse\s*\(\s*req\./g, () => {
    changed = true;
    return "SECSPHERE_SAFE_JSON_PARSE(req.";
  });

  if (changed && CODE_LIKE_EXTENSIONS.has(extension) && updated.includes("SECSPHERE_SAFE_JSON_PARSE(")) {
    const helperResult = prependHelperIfMissing(
      updated,
      "const SECSPHERE_SAFE_JSON_PARSE =",
      [
        "const SECSPHERE_SAFE_JSON_PARSE = (value) => {",
        "  try {",
        "    return JSON.parse(String(value));",
        "  } catch {",
        "    return {};",
        "  }",
        "};",
      ].join("\n")
    );

    return {
      changed: changed || helperResult.changed,
      updated: helperResult.updated,
      strategy: "safe-deserialization",
    };
  }

  return {
    changed,
    updated,
    strategy: changed ? "safe-deserialization" : null,
  };
};

const applyWeakCryptographyFix = (content) => {
  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/crypto\.createHash\s*\(\s*["']md5["']\s*\)/gi, () => {
    changed = true;
    return 'crypto.createHash("sha256")';
  });

  updated = updated.replace(/crypto\.createHash\s*\(\s*["']sha1["']\s*\)/gi, () => {
    changed = true;
    return 'crypto.createHash("sha256")';
  });

  updated = updated.replace(/hashlib\.md5\s*\(/g, () => {
    changed = true;
    return "hashlib.sha256(";
  });

  updated = updated.replace(/hashlib\.sha1\s*\(/g, () => {
    changed = true;
    return "hashlib.sha256(";
  });

  return {
    changed,
    updated,
    strategy: changed ? "strong-cryptography" : null,
  };
};

const applyMissingRateLimitingFix = (content, extension) => {
  if (!CODE_LIKE_EXTENSIONS.has(extension)) {
    return {
      changed: false,
      updated: String(content || ""),
      strategy: null,
    };
  }

  let changed = false;
  let updated = String(content || "");

  const hasRoutes = /\b(app|router)\.(get|post|put|delete)\s*\(/.test(updated);
  const hasLimiter = /rate[-_ ]?limit|SECSPHERE_RATE_LIMIT/.test(updated);

  if (!hasRoutes || hasLimiter) {
    return {
      changed: false,
      updated,
      strategy: null,
    };
  }

  updated = updated.replace(/const\s+app\s*=\s*express\s*\(\s*\)\s*;/, (full) => {
    changed = true;
    return `${full}\napp.use(SECSPHERE_RATE_LIMIT);`;
  });

  updated = updated.replace(/const\s+router\s*=\s*express\.Router\s*\(\s*\)\s*;/, (full) => {
    changed = true;
    return `${full}\nrouter.use(SECSPHERE_RATE_LIMIT);`;
  });

  const helperResult = prependHelperIfMissing(
    updated,
    "const SECSPHERE_RATE_LIMIT =",
    [
      "const SECSPHERE_RATE_BUCKET = new Map();",
      "const SECSPHERE_RATE_LIMIT = (req, res, next) => {",
      "  const key = String(req.ip || req.headers?.[\"x-forwarded-for\"] || \"anon\");",
      "  const now = Date.now();",
      "  const windowMs = 60 * 1000;",
      "  const maxHits = 120;",
      "  const existing = SECSPHERE_RATE_BUCKET.get(key) || { count: 0, start: now };",
      "  if (now - existing.start > windowMs) {",
      "    existing.count = 0;",
      "    existing.start = now;",
      "  }",
      "  existing.count += 1;",
      "  SECSPHERE_RATE_BUCKET.set(key, existing);",
      "  if (existing.count > maxHits) {",
      "    return res.status(429).json({ error: \"Too many requests\" });",
      "  }",
      "  return next();",
      "};",
    ].join("\n")
  );

  return {
    changed: changed || helperResult.changed,
    updated: helperResult.updated,
    strategy: changed || helperResult.changed ? "rate-limiting-guard" : null,
  };
};

const applyCorsMisconfigurationFix = (content) => {
  const corsResult = applyCorsWildcardFix(content);
  let changed = corsResult.changed;
  let updated = corsResult.updated;

  updated = updated.replace(/origin\s*:\s*["']\*["']/gi, () => {
    changed = true;
    return 'origin: "http://localhost:5173"';
  });

  updated = updated.replace(/cors\s*\(\s*\)/g, () => {
    changed = true;
    return 'cors({ origin: "http://localhost:5173" })';
  });

  return {
    changed,
    updated,
    strategy: changed ? "cors-allowlist" : null,
  };
};

const applyUploadSecurityFix = (content, extension) => {
  if (!CODE_LIKE_EXTENSIONS.has(extension)) {
    return {
      changed: false,
      updated: String(content || ""),
      strategy: null,
    };
  }

  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/(upload\.(?:single|array|fields)\s*\([^)]*\))\s*,/g, (full, uploaderCall) => {
    changed = true;
    return `${uploaderCall}, SECSPHERE_VALIDATE_UPLOAD_FILE,`;
  });

  if (changed) {
    const helperResult = prependHelperIfMissing(
      updated,
      "const SECSPHERE_VALIDATE_UPLOAD_FILE =",
      [
        "const SECSPHERE_ALLOWED_MIME_TYPES = new Set([",
        "  \"image/jpeg\",",
        "  \"image/png\",",
        "  \"application/pdf\",",
        "  \"text/plain\",",
        "]);",
        "const SECSPHERE_VALIDATE_UPLOAD_FILE = (req, res, next) => {",
        "  if (req.file && !SECSPHERE_ALLOWED_MIME_TYPES.has(String(req.file.mimetype || \"\").toLowerCase())) {",
        "    return res.status(400).json({ error: \"Unsupported upload type\" });",
        "  }",
        "  if (req.file && Number(req.file.size || 0) > 5 * 1024 * 1024) {",
        "    return res.status(400).json({ error: \"File too large\" });",
        "  }",
        "  return next();",
        "};",
      ].join("\n")
    );

    return {
      changed: changed || helperResult.changed,
      updated: helperResult.updated,
      strategy: "upload-security-guard",
    };
  }

  return {
    changed,
    updated,
    strategy: changed ? "upload-security-guard" : null,
  };
};

const applyHiddenMalwareFix = (content, extension) => {
  let changed = false;
  let updated = String(content || "");

  updated = updated.replace(/nc\s+-e\s+\/bin\/sh/gi, () => {
    changed = true;
    return "echo blocked_malware_pattern";
  });

  updated = updated.replace(/\/bin\/bash\s+-i/gi, () => {
    changed = true;
    return "echo blocked_interactive_shell";
  });

  updated = updated.replace(/powershell\s+-enc/gi, () => {
    changed = true;
    return "powershell -Command Write-Output blocked_payload";
  });

  updated = updated.replace(/reverse\s+shell/gi, () => {
    changed = true;
    return "blocked shell marker";
  });

  if (extension === ".py") {
    updated = updated.replace(/^\s*import\s+socket\s*$/gm, () => {
      changed = true;
      return "# import socket  # [SECSPHERE] blocked hidden-malware marker";
    });
  }

  return {
    changed,
    updated,
    strategy: changed ? "malware-pattern-neutralization" : null,
  };
};

const applyGuidedRemediationFallback = ({ content, vulnerability, selectedFix, extension }) => {
  const source = String(content || "");
  const safeVulnerability = String(vulnerability || "Unknown vulnerability").trim();
  const safeFix = String(selectedFix || "Apply secure coding remediation").replace(/\s+/g, " ").trim();
  const marker = `[SECSPHERE-AUTO-FIX:${safeVulnerability}]`;

  if (source.includes(marker)) {
    return {
      changed: false,
      updated: source,
      strategy: null,
    };
  }

  if (extension === ".json") {
    try {
      const parsed = JSON.parse(source);
      const current = Array.isArray(parsed?._secsphereHardeningNotes)
        ? parsed._secsphereHardeningNotes
        : [];
      parsed._secsphereHardeningNotes = [
        ...current,
        {
          vulnerability: safeVulnerability,
          recommendation: safeFix,
        },
      ];

      return {
        changed: true,
        updated: `${JSON.stringify(parsed, null, 2)}${source.endsWith("\n") ? "\n" : ""}`,
        strategy: "guided-remediation-note",
      };
    } catch {
      // Continue with text fallback.
    }
  }

  const noteLines = [
    `${marker}`,
    `Recommendation: ${safeFix}`,
  ];

  if (extension === ".py" || extension === ".txt" || extension === ".yml" || extension === ".yaml" || extension === ".env" || extension === ".ini") {
    const commented = noteLines.map((line) => `# ${line}`).join("\n");
    return {
      changed: true,
      updated: `${commented}\n${source}`,
      strategy: "guided-remediation-note",
    };
  }

  const blockComment = `/*\n${noteLines.map((line) => ` * ${line}`).join("\n")}\n */`;
  return {
    changed: true,
    updated: `${blockComment}\n${source}`,
    strategy: "guided-remediation-note",
  };
};

const withGuidedFallback = (result, fallbackContext) => {
  if (result?.changed) {
    return result;
  }

  return applyGuidedRemediationFallback(fallbackContext);
};

const applyFixHeuristic = ({ content, vulnerability, selectedFix, extension, targetPath }) => {
  const title = String(vulnerability || "").toLowerCase();
  const fallbackContext = {
    content,
    vulnerability,
    selectedFix,
    extension,
  };

  if (/sensitive\s+data\s+exposure|hardcoded\s+secret|possible\s+hardcoded\s+secret|possible\s+aws\s+access\s+key|private\s+key|token|password|sensitive\s+file\s+explicitly\s+included/.test(title)) {
    return withGuidedFallback(applySensitiveDataExposureFix(content, extension), fallbackContext);
  }

  if (/injection\s+vulnerabilit|unsafe\s+eval\s+usage|dynamic\s+function\s+constructor\s+usage|potential\s+command\s+execution/.test(title)) {
    return withGuidedFallback(applyInjectionVulnerabilityFix(content, extension), fallbackContext);
  }

  if (/cross-site\s+scripting|\bxss\b/.test(title)) {
    return withGuidedFallback(applyXssFix(content, extension), fallbackContext);
  }

  if (/missing\s+input\s+validation/.test(title)) {
    return withGuidedFallback(applyMissingInputValidationFix(content, extension), fallbackContext);
  }

  if (/hardcoded\s+debug|dev\s+config|incomplete\s+ignore\s+hardening/.test(title)) {
    return withGuidedFallback(applyHardcodedDebugConfigFix(content), fallbackContext);
  }

  if (/insecure\s+authentication\s+logic/.test(title)) {
    return withGuidedFallback(applyInsecureAuthenticationLogicFix(content, extension), fallbackContext);
  }

  if (/broken\s+access\s+control/.test(title)) {
    return withGuidedFallback(applyBrokenAccessControlFix(content, extension), fallbackContext);
  }

  if (/wildcard\s+cors\s+origin|cors/.test(title)) {
    return withGuidedFallback(applyCorsMisconfigurationFix(content), fallbackContext);
  }

  if (/iam\s+wildcard\s+action|iam\s+wildcard\s+resource|administratoraccess/.test(title)) {
    return withGuidedFallback(applyIamWildcardFix(content), fallbackContext);
  }

  if (/open\s+network\s+access|0\.0\.0\.0\/0|ssl\s+disabled|insecure\s+network\s+usage/.test(title)) {
    return withGuidedFallback(applyOpenNetworkFix(content), fallbackContext);
  }

  if (/insecure\s+dependenc/.test(title)) {
    return withGuidedFallback(applyInsecureDependenciesFix(content, extension, targetPath), fallbackContext);
  }

  if (/sensitive\s+logging/.test(title)) {
    return withGuidedFallback(applySensitiveLoggingFix(content), fallbackContext);
  }

  if (/improper\s+error\s+handling/.test(title)) {
    return withGuidedFallback(applyImproperErrorHandlingFix(content), fallbackContext);
  }

  if (/deserialization\s+vulnerabilit/.test(title)) {
    return withGuidedFallback(applyDeserializationFix(content, extension), fallbackContext);
  }

  if (/path\s+traversal/.test(title)) {
    return withGuidedFallback(applyPathTraversalFix(content, extension), fallbackContext);
  }

  if (/insecure\s+file\s+handling/.test(title)) {
    return withGuidedFallback(applyInsecureFileHandlingFix(content, extension), fallbackContext);
  }

  if (/weak\s+cryptography/.test(title)) {
    return withGuidedFallback(applyWeakCryptographyFix(content), fallbackContext);
  }

  if (/missing\s+rate\s+limiting/.test(title)) {
    return withGuidedFallback(applyMissingRateLimitingFix(content, extension), fallbackContext);
  }

  if (/cors\s+misconfiguration/.test(title)) {
    return withGuidedFallback(applyCorsMisconfigurationFix(content), fallbackContext);
  }

  if (/file\s+type\s+spoofing|large\s+file\s+upload/.test(title)) {
    return withGuidedFallback(applyUploadSecurityFix(content, extension), fallbackContext);
  }

  if (/hidden\s+malware|backdoors?/.test(title)) {
    return withGuidedFallback(applyHiddenMalwareFix(content, extension), fallbackContext);
  }

  return applyGuidedRemediationFallback(fallbackContext);
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
    selectedFix,
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
