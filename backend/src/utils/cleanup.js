import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");

const ALLOWED_CLEANUP_ROOTS = [
  path.join(backendRoot, "src", "temp"),
  path.join(backendRoot, "src", "uploads"),
].map((entry) => path.resolve(entry));

const isInsideRoot = (rootDir, targetPath) => {
  const relative = path.relative(rootDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const isAllowedCleanupPath = (targetPath) =>
  ALLOWED_CLEANUP_ROOTS.some((rootDir) => isInsideRoot(rootDir, targetPath));

export const cleanupTempPaths = async (tempPaths) => {
  const uniquePaths = [...new Set((tempPaths || []).filter(Boolean))];

  for (const tempPath of uniquePaths) {
    try {
      const resolvedTempPath = path.resolve(String(tempPath));

      if (!isAllowedCleanupPath(resolvedTempPath)) {
        console.warn(`[scan] cleanup skipped outside allowed roots: ${resolvedTempPath}`);
        continue;
      }

      await fs.remove(resolvedTempPath);
    } catch (error) {
      console.warn(`[scan] cleanup failed: ${tempPath} -> ${error.message}`);
    }
  }
};
