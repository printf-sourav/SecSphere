import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import fs from "fs-extra";
import path from "path";
import { extractZip } from "../integrations/zipHandler.js";
import { cloneRepo } from "../integrations/repoScanner.js";
import {
  runSemgrepScan,
  runTrivyDependencyScan,
} from "../integrations/securityTools.js";
import { walkFiles } from "../utils/fileWalker.js";
import { scanCode } from "../services/codeScanner.js";
import { scanConfig } from "../services/configScanner.js";
import { scanIAM } from "../services/iamScanner.js";
import { scanGitignore } from "../services/gitignoreScanner.js";
import { scanSecurityMisconfig } from "../services/securityMisconfigScanner.js";
import {
  explainIssue,
  generateSummary,
  generateBestPractices,
} from "../services/aiService.js";
import {
  getLearnedFixExamples,
  recordUserFixFeedback,
} from "../services/learningService.js";
import { calculateScore, sortIssuesBySeverity } from "../utils/riskScore.js";
import { predictRiskScore } from "../utils/riskPredictor.js";
import { inferProjectContext } from "../utils/projectContext.js";
import { cleanupTempPaths } from "../utils/cleanup.js";

const MAX_ISSUES = 5;
const MAX_AI_ISSUES = 5;
const MAX_FILES_TO_SCAN = 2000;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".txt",
  ".env",
  ".yml",
  ".yaml",
  ".tf",
  ".md",
  ".ini",
  ".conf",
]);

const isScannableFile = (filePath) => {
  const base = path.basename(filePath).toLowerCase();
  if (base === ".env") {
    return true;
  }

  const ext = path.extname(base);
  return SCANNABLE_EXTENSIONS.has(ext);
};

const toIssueWithContext = (issue, filePath, basePath) => ({
  ...issue,
  file: basePath ? path.relative(basePath, filePath) : path.basename(filePath),
});

const isValidGithubRepoUrl = (repoUrl) => {
  try {
    const url = new URL(repoUrl);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    return (host === "github.com" || host === "www.github.com") && parts.length >= 2;
  } catch {
    return false;
  }
};

const readTextSafely = async (filePath) => {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_TEXT_FILE_BYTES) {
      return null;
    }

    const content = await fs.readFile(filePath, "utf8");

    if (content.includes("\u0000")) {
      return null;
    }

    return content;
  } catch {
    return null;
  }
};

const runAllScanners = (text, filePath = "") => {
  const issues = [
    ...scanCode(text),
    ...scanConfig(text),
    ...scanIAM(text),
    ...scanSecurityMisconfig(text),
  ];

  if (path.basename(filePath).toLowerCase() === ".gitignore") {
    issues.push(...scanGitignore(text));
  }

  return issues;
};

const isZipUpload = (file) => {
  if (!file) {
    return false;
  }

  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  return (
    ext === ".zip" ||
    mime === "application/zip" ||
    mime === "application/x-zip-compressed" ||
    mime === "multipart/x-zip"
  );
};

export const handleScan = async (req, res) => {
  const tempPaths = [];
  let inputType = "unknown";
  let fileLimitReached = false;
  let repoUrl = "";
  let scannedFilePaths = [];

  try {
    console.log("[scan] request received");

    if (req.file?.path) {
      tempPaths.push(req.file.path);
    }

    let folderPath = null;
    let singleFileContent = null;
    let singleFileName = null;

    if (req.file && isZipUpload(req.file)) {
      inputType = "ZIP";

      try {
        folderPath = await extractZip(req.file.path);
      } catch {
        throw new ApiError(400, "Invalid ZIP file");
      }

      tempPaths.push(folderPath);
    }

    repoUrl = req.body?.repoUrl?.trim() || "";

    if (!folderPath && repoUrl) {
      if (!isValidGithubRepoUrl(repoUrl)) {
        throw new ApiError(400, "Invalid repository URL");
      }

      inputType = "Repo";

      try {
        folderPath = await cloneRepo(repoUrl);
      } catch {
        throw new ApiError(400, "Invalid repository URL");
      }

      tempPaths.push(folderPath);
    }

    if (!folderPath && req.file) {
      inputType = "File";

      if (!isScannableFile(req.file.originalname || req.file.path)) {
        throw new ApiError(400, "Unsupported file type for scanning.");
      }

      singleFileContent = await readTextSafely(req.file.path);
      singleFileName = req.file.originalname || path.basename(req.file.path);

      if (singleFileContent === null) {
        throw new ApiError(400, "File read error");
      }

      if (singleFileContent.trim().length === 0) {
        throw new ApiError(400, "Empty file uploaded");
      }
    }

    if (!folderPath && !singleFileContent) {
      throw new ApiError(400, "No input provided");
    }

    console.log(`[scan] Input type: ${inputType}`);

    const allIssues = [];
    let scannedFiles = 0;

    if (folderPath) {
      const files = await walkFiles(folderPath, { maxFiles: MAX_FILES_TO_SCAN });
      scannedFilePaths = files;
      fileLimitReached = files.length >= MAX_FILES_TO_SCAN;

      console.log(`[scan] Scanning ${files.length} files...`);

      if (fileLimitReached) {
        console.warn(`[scan] File scan limit reached at ${MAX_FILES_TO_SCAN} files`);
      }

      for (const filePath of files) {
        if (!isScannableFile(filePath)) {
          continue;
        }

        const text = await readTextSafely(filePath);
        if (!text) {
          continue;
        }

        scannedFiles += 1;

        const fileIssues = runAllScanners(text, filePath).map((issue) =>
          toIssueWithContext(issue, filePath, folderPath)
        );

        allIssues.push(...fileIssues);
      }
    }

    if (singleFileContent) {
      scannedFiles = 1;
      scannedFilePaths = [singleFileName];

      const fileIssues = runAllScanners(singleFileContent, singleFileName).map((issue) => ({
        ...issue,
        file: singleFileName,
      }));

      allIssues.push(...fileIssues);
    }

    if (folderPath) {
      const semgrepResult = await runSemgrepScan(folderPath, {
        basePath: folderPath,
      });

      if (semgrepResult.status === "ok") {
        allIssues.push(...semgrepResult.issues);
        console.log(`[scan] Semgrep detected ${semgrepResult.issues.length} issues`);
      } else {
        console.log(`[scan] Semgrep skipped: ${semgrepResult.reason}`);
      }

      const trivyResult = await runTrivyDependencyScan(folderPath, {
        basePath: folderPath,
      });

      if (trivyResult.status === "ok") {
        allIssues.push(...trivyResult.issues);
        console.log(`[scan] Trivy detected ${trivyResult.issues.length} issues`);
      } else {
        console.log(`[scan] Trivy skipped: ${trivyResult.reason}`);
      }
    }

    if (singleFileContent && req.file?.path) {
      const semgrepResult = await runSemgrepScan(req.file.path, {
        basePath: path.dirname(req.file.path),
      });

      if (semgrepResult.status === "ok") {
        const normalizedSemgrepIssues = semgrepResult.issues.map((issue) => ({
          ...issue,
          file: singleFileName,
        }));

        allIssues.push(...normalizedSemgrepIssues);
        console.log(`[scan] Semgrep detected ${normalizedSemgrepIssues.length} issues`);
      } else {
        console.log(`[scan] Semgrep skipped: ${semgrepResult.reason}`);
      }
    }

    const prioritizedIssues = sortIssuesBySeverity(allIssues);
    const limitedIssues = prioritizedIssues.slice(0, MAX_ISSUES);
    const aiIssues = limitedIssues.slice(0, MAX_AI_ISSUES);

    const projectContext = inferProjectContext({
      repoUrl,
      filePaths: scannedFilePaths,
      sampleText: singleFileContent,
      declaredProjectType: req.body?.projectType,
    });

    console.log(`[scan] Scanned files: ${scannedFiles}`);
    console.log(`[scan] Detected ${limitedIssues.length} issues`);
    console.log("[scan] AI processing started...");

    const results = await Promise.all(
      aiIssues.map(async (issue) => {
        const learnedExamples = await getLearnedFixExamples({
          title: issue.title,
          projectType: projectContext.domain,
          limit: 2,
        });

        const ai = await explainIssue(issue.title, {
          projectContext,
          learnedExamples,
        });

        const result = {
          title: issue.title,
          severity: issue.severity,
          file: issue.file,
          line: issue.line,
        };

        if (ai?.explanation && ai?.fix) {
          result.explanation = ai.explanation;
          result.fix = ai.fix;
        }

        if (learnedExamples.length) {
          result.learningHints = learnedExamples.map((item) => ({
            vulnerability: item.vulnerability,
            source: item.source,
            usageCount: Number(item.usageCount || 0),
          }));
        }

        return result;
      })
    );

    console.log("[scan] AI processing completed");

    const summary = limitedIssues.length
      ? await generateSummary(limitedIssues, { projectContext })
      : "No vulnerabilities found";

    const bestPractices = await generateBestPractices(limitedIssues, {
      projectContext,
    });

    const score = calculateScore(limitedIssues);
    const riskPrediction = predictRiskScore(limitedIssues, projectContext);

    return res.json(
      new ApiResponse(
        200,
        {
          results,
          summary,
          score,
          predictedScore: riskPrediction.predictedScore,
          riskBand: riskPrediction.riskBand,
          riskModel: riskPrediction.model,
          projectContext,
          bestPractices,
        },
        "Scan completed"
      )
    );

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, error.message || "Error in scan controller");
  } finally {
    console.log(`[scan] cleanup started for ${tempPaths.length} temp paths`);
    await cleanupTempPaths(tempPaths);
    console.log("[scan] cleanup completed");
  }
};

export const handleFixFeedback = async (req, res) => {
  const vulnerability = req.body?.vulnerability || req.body?.title;
  const fix = req.body?.fix;

  if (!vulnerability || !fix) {
    throw new ApiError(400, "vulnerability and fix are required");
  }

  const saved = await recordUserFixFeedback({
    vulnerability,
    fix,
    projectType: req.body?.projectType,
    file: req.body?.file,
    notes: req.body?.notes,
  });

  return res.json(
    new ApiResponse(
      200,
      {
        id: saved.id,
        vulnerability: saved.vulnerability,
        projectType: saved.projectType,
        usageCount: saved.usageCount,
        firstAppliedAt: saved.firstAppliedAt,
        lastAppliedAt: saved.lastAppliedAt,
      },
      "Fix feedback recorded"
    )
  );
};