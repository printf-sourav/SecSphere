import fs from "fs-extra";
import path from "path";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
]);

export const walkFiles = async (rootDir, options = {}) => {
  const maxFiles = options.maxFiles ?? 2000;
  const files = [];

  const walk = async (currentDir) => {
    if (files.length >= maxFiles) {
      return;
    }

    let entries;

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        break;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }

        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };

  await walk(rootDir);
  return files;
};
