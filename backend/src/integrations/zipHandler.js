import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import AdmZip from "adm-zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const extractedBaseDir = path.join(backendRoot, "src", "temp", "extracted");

export const extractZip = async (zipFilePath) => {
  if (!zipFilePath) {
    throw new Error("zipFilePath is required");
  }

  await fs.ensureDir(extractedBaseDir);

  const extractFolderName = `zip-${Date.now()}`;
  const outputDir = path.join(extractedBaseDir, extractFolderName);
  await fs.ensureDir(outputDir);

  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(outputDir, true);

  return outputDir;
};
