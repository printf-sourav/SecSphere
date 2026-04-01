import fs from "fs-extra";

export const cleanupTempPaths = async (tempPaths) => {
  const uniquePaths = [...new Set((tempPaths || []).filter(Boolean))];

  for (const tempPath of uniquePaths) {
    try {
      await fs.remove(tempPath);
    } catch (error) {
      console.warn(`[scan] cleanup failed: ${tempPath} -> ${error.message}`);
    }
  }
};
