import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import fs from "fs-extra";
import path from "path";
import {
  createZipScanReportFile,
  createZipScanReportPdf,
  compressDirectory,
  extractZip,
  getZipProcessingRecord,
  recordZipProcessingLocation,
} from "../integrations/zipHandler.js";
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
  buildVulnerabilityReport,
  scanVulnerabilityCatalog,
} from "../services/vulnerabilityCatalogScanner.js";
import {
  explainIssue,
  generateSummary,
  generateBestPractices,
} from "../services/aiService.js";
import {
  getLearnedFixExamples,
  recordUserFixFeedback,
} from "../services/learningService.js";
import { applyFixToCodebase } from "../services/fixApplyService.js";
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

const toSafeDisplayFileName = (value) => {
  const normalized = String(value || "").replace(/\\/g, "/");
  return path.posix.basename(normalized) || "uploaded-file";
};

const isValidGithubRepoUrl = (repoUrl) => {
  try {
    const url = new URL(repoUrl);
    const host = url.hostname.toLowerCase();
    const isGitHubHost = host === "github.com" || host === "www.github.com";

    if (!isGitHubHost || url.protocol !== "https:") {
      return false;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const owner = parts[0] || "";
    const repo = (parts[1] || "").replace(/\.git$/i, "");

    return Boolean(owner && repo);
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
    ...scanVulnerabilityCatalog(text, filePath),
  ];

  if (path.basename(filePath).toLowerCase() === ".gitignore") {
    issues.push(...scanGitignore(text));
  }

  return issues;
};

const collectIssuesForFolder = async (folderPath) => {
  const issues = [];
  const files = await walkFiles(folderPath, { maxFiles: MAX_FILES_TO_SCAN });

  for (const filePath of files) {
    if (!isScannableFile(filePath)) {
      continue;
    }

    const text = await readTextSafely(filePath);
    if (!text) {
      continue;
    }

    const fileIssues = runAllScanners(text, filePath).map((issue) =>
      toIssueWithContext(issue, filePath, folderPath)
    );

    issues.push(...fileIssues);
  }

  const semgrepResult = await runSemgrepScan(folderPath, {
    basePath: folderPath,
  });

  if (semgrepResult.status === "ok") {
    issues.push(...semgrepResult.issues);
  }

  const trivyResult = await runTrivyDependencyScan(folderPath, {
    basePath: folderPath,
  });

  if (trivyResult.status === "ok") {
    issues.push(...trivyResult.issues);
  }

  return sortIssuesBySeverity(issues);
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
  let zipScanSessionId = null;

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

      const zipRecord = await recordZipProcessingLocation({
        uploadedZipPath: req.file.path,
        extractedPath: folderPath,
        sourceType: "zip",
        sourceRef: req.file.originalname || req.file.path,
      });
      zipScanSessionId = zipRecord.id;
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

      const repoRecord = await recordZipProcessingLocation({
        extractedPath: folderPath,
        sourceType: "repo",
        sourceRef: repoUrl,
      });
      zipScanSessionId = repoRecord.id;
    }

    if (!folderPath && req.file) {
      inputType = "File";

      if (!isScannableFile(req.file.originalname || req.file.path)) {
        throw new ApiError(400, "Unsupported file type for scanning.");
      }

      singleFileContent = await readTextSafely(req.file.path);
      singleFileName = toSafeDisplayFileName(req.file.originalname || req.file.path);

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
          issue,
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
            fix: item.fix,
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
    const vulnerabilityReport = buildVulnerabilityReport(allIssues);

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
          vulnerabilityReport,
          scanSessionId: zipScanSessionId,
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

export const handleApplyFixToCodebase = async (req, res) => {
  const vulnerability = req.body?.vulnerability || req.body?.title;
  const fix = req.body?.fix;
  const file = req.body?.file || req.body?.relativeFilePath;
  const scanSessionId = String(req.body?.scanSessionId || "").trim();

  if (!vulnerability || !fix || !file) {
    throw new ApiError(400, "vulnerability, fix and file are required");
  }

  try {
    let projectRoot;

    if (scanSessionId) {
      const sessionRecord = await getZipProcessingRecord(scanSessionId);
      if (!sessionRecord?.extractedPath || !(await fs.pathExists(sessionRecord.extractedPath))) {
        throw new Error("Scan session is missing or expired. Re-scan the repository/ZIP and try again.");
      }

      projectRoot = sessionRecord.extractedPath;
    }

    const applied = await applyFixToCodebase({
      relativeFilePath: file,
      vulnerability,
      selectedFix: fix,
      projectRoot,
    });

    return res.json(
      new ApiResponse(
        200,
        applied,
        "Fix applied to codebase"
      )
    );
  } catch (error) {
    throw new ApiError(400, error.message || "Unable to apply fix to codebase");
  }
};

export const handleDownloadFixedZipFromSession = async (req, res) => {
  const scanSessionId = String(req.body?.scanSessionId || req.query?.scanSessionId || "").trim();

  if (!scanSessionId) {
    throw new ApiError(400, "scanSessionId is required");
  }

  const sessionRecord = await getZipProcessingRecord(scanSessionId);
  if (!sessionRecord?.extractedPath || !(await fs.pathExists(sessionRecord.extractedPath))) {
    throw new ApiError(400, "Scan session is missing or expired. Re-scan the repository/ZIP and try again.");
  }

  const outputZipPath = await compressDirectory(sessionRecord.extractedPath, `fixed-${scanSessionId}`);
  const outputFileName = `fixed-${scanSessionId}.zip`;

  return res.download(outputZipPath, outputFileName, async () => {
    await cleanupTempPaths([outputZipPath]);
  });
};

export const handleFixZipAndReturn = async (req, res) => {
  const tempPaths = [];

  if (!req.file || !isZipUpload(req.file)) {
    throw new ApiError(400, "ZIP file is required");
  }

  tempPaths.push(req.file.path);

  let extractedPath = "";
  let outputZipPath = "";

  try {
    extractedPath = await extractZip(req.file.path);
    tempPaths.push(extractedPath);

    const record = await recordZipProcessingLocation({
      uploadedZipPath: req.file.path,
      extractedPath,
    });

    const allIssues = await collectIssuesForFolder(extractedPath);
    const dedupedIssues = [];
    const seen = new Set();

    for (const issue of allIssues) {
      const issueKey = `${String(issue.file || "").toLowerCase()}::${String(issue.title || "").toLowerCase()}`;
      if (seen.has(issueKey)) {
        continue;
      }

      seen.add(issueKey);
      dedupedIssues.push(issue);
    }

    const appliedFixes = [];

    for (const issue of dedupedIssues) {
      if (!issue.file || !issue.title || !issue.fix) {
        continue;
      }

      try {
        const applied = await applyFixToCodebase({
          relativeFilePath: issue.file,
          vulnerability: issue.title,
          selectedFix: issue.fix,
          projectRoot: extractedPath,
        });

        appliedFixes.push({
          file: applied.file,
          vulnerability: issue.title,
          strategy: applied.strategy,
        });
      } catch {
        // Skip issues with no safe auto-fix heuristic.
      }
    }

    outputZipPath = await compressDirectory(extractedPath, "fixed-project");
    tempPaths.push(outputZipPath);

    res.setHeader("X-Scan-Session-Id", record.id);
    res.setHeader("X-Issues-Detected", String(allIssues.length));
    res.setHeader("X-Fixes-Applied", String(appliedFixes.length));

    const outputName = `fixed-${path.basename(req.file.originalname || "project.zip", ".zip")}.zip`;

    return res.download(outputZipPath, outputName, async () => {
      await cleanupTempPaths(tempPaths);
    });
  } catch (error) {
    await cleanupTempPaths(tempPaths);
    throw new ApiError(400, error.message || "Unable to process ZIP and apply fixes");
  }
};

export const handleZipReportDownload = async (req, res) => {
  const tempPaths = [];
  const format = String(req.query?.format || req.body?.format || "json")
    .trim()
    .toLowerCase();

  if (!["json", "pdf"].includes(format)) {
    throw new ApiError(400, "format must be either json or pdf");
  }

  if (!req.file || !isZipUpload(req.file)) {
    throw new ApiError(400, "ZIP file is required");
  }

  tempPaths.push(req.file.path);

  try {
    const extractedPath = await extractZip(req.file.path);
    tempPaths.push(extractedPath);

    const record = await recordZipProcessingLocation({
      uploadedZipPath: req.file.path,
      extractedPath,
    });

    const allIssues = await collectIssuesForFolder(extractedPath);
    const vulnerabilityReport = buildVulnerabilityReport(allIssues);
    const sortedIssues = sortIssuesBySeverity(allIssues);
    const topFindings = sortedIssues.slice(0, 100);

    const severityBreakdown = sortedIssues.reduce(
      (acc, issue) => {
        const severity = String(issue?.severity || "low").toLowerCase();

        if (severity === "critical") {
          acc.critical += 1;
        } else if (severity === "high") {
          acc.high += 1;
        } else if (severity === "medium") {
          acc.medium += 1;
        } else {
          acc.low += 1;
        }

        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 }
    );

    const reportPayload = {
      generatedAt: new Date().toISOString(),
      workflow: "zip-report-download",
      input: {
        uploadedFileName: toSafeDisplayFileName(req.file.originalname || req.file.path),
        scanSessionId: record.id,
      },
      summary: {
        totalFindings: sortedIssues.length,
        severityBreakdown,
      },
      vulnerabilityReport,
      findings: topFindings,
      note: "findings contains top 100 prioritized issues. vulnerabilityReport includes full category coverage for configured rules.",
    };

    const reportBaseName = path.basename(req.file.originalname || "zip-report", ".zip");
    const reportPath =
      format === "pdf"
        ? await createZipScanReportPdf(reportPayload, reportBaseName)
        : await createZipScanReportFile(reportPayload, reportBaseName);
    tempPaths.push(reportPath);

    const reportFileName = `${reportBaseName}-security-report.${format}`;

    res.setHeader("X-Scan-Session-Id", record.id);
    res.setHeader("X-Report-Findings", String(sortedIssues.length));
    res.setHeader("X-Report-Format", format);

    return res.download(reportPath, reportFileName, async () => {
      await cleanupTempPaths(tempPaths);
    });
  } catch (error) {
    await cleanupTempPaths(tempPaths);
    throw new ApiError(400, error.message || "Unable to generate ZIP scan report");
  }
};