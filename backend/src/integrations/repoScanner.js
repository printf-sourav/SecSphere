import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { simpleGit } from "simple-git";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const reposBaseDir = path.join(backendRoot, "src", "temp", "repos");

const sanitizeRepoName = (repoUrl) => {
  const cleaned = repoUrl.trim().replace(/\.git$/i, "");
  const rawName = cleaned.split("/").pop() || "repo";
  return rawName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
};

export const cloneRepo = async (repoUrl) => {
  if (!repoUrl) {
    throw new Error("repoUrl is required");
  }

  const repoName = sanitizeRepoName(repoUrl);
  const targetDir = path.join(reposBaseDir, `${repoName}-${Date.now()}`);

  await fs.ensureDir(reposBaseDir);

  const git = simpleGit();
  await git.clone(repoUrl, targetDir, ["--depth", "1"]);

  return targetDir;
};
