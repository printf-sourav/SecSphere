import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import AdmZip from "adm-zip";
import PDFDocument from "pdfkit";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const extractedBaseDir = path.join(backendRoot, "src", "temp", "extracted");
const jobsBaseDir = path.join(backendRoot, "src", "temp", "jobs");
const outputBaseDir = path.join(backendRoot, "src", "temp", "output");
const uploadsBaseDir = path.join(backendRoot, "src", "uploads");

const MAX_ZIP_ENTRIES = Number(process.env.MAX_ZIP_ENTRIES || 5000);
const MAX_ZIP_ENTRY_BYTES = Number(process.env.MAX_ZIP_ENTRY_BYTES || 10 * 1024 * 1024);
const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = Number(
  process.env.MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES || 200 * 1024 * 1024
);

const isInsideRoot = (rootDir, targetPath) => {
  const relative = path.relative(rootDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const resolvePathInsideBase = (baseDir, targetPath, label) => {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  if (!isInsideRoot(resolvedBase, resolvedTarget)) {
    throw new Error(`${label} is outside allowed directory`);
  }

  return resolvedTarget;
};

const normalizeZipEntryName = (entryName) => {
  const normalized = path.posix
    .normalize(String(entryName || "").replace(/\\/g, "/"))
    .replace(/^\/+/, "");

  if (!normalized || normalized === ".") {
    return null;
  }

  if (normalized.startsWith("../") || normalized.includes("/../")) {
    return null;
  }

  return normalized;
};

export const extractZip = async (zipFilePath) => {
  if (!zipFilePath) {
    throw new Error("zipFilePath is required");
  }

  await fs.ensureDir(extractedBaseDir);

  const extractFolderName = `zip-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const outputDir = path.join(extractedBaseDir, extractFolderName);
  await fs.ensureDir(outputDir);

  try {
    const zip = new AdmZip(zipFilePath);
    const entries = zip.getEntries();

    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new Error("ZIP contains too many entries");
    }

    let totalUncompressedBytes = 0;

    for (const entry of entries) {
      const normalizedEntryName = normalizeZipEntryName(entry.entryName);
      if (!normalizedEntryName) {
        throw new Error("ZIP contains unsafe file paths");
      }

      const destinationPath = resolvePathInsideBase(
        outputDir,
        path.resolve(outputDir, normalizedEntryName),
        "ZIP entry"
      );

      if (entry.isDirectory || normalizedEntryName.endsWith("/")) {
        await fs.ensureDir(destinationPath);
        continue;
      }

      const declaredSize = Number(entry.header?.size || 0);
      if (Number.isFinite(declaredSize) && declaredSize > MAX_ZIP_ENTRY_BYTES) {
        throw new Error("ZIP entry exceeds maximum allowed size");
      }

      const data = entry.getData();
      const actualSize = Number(data.length || 0);
      if (actualSize > MAX_ZIP_ENTRY_BYTES) {
        throw new Error("ZIP entry exceeds maximum allowed size");
      }

      totalUncompressedBytes += actualSize;
      if (totalUncompressedBytes > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
        throw new Error("ZIP exceeds maximum allowed uncompressed size");
      }

      await fs.ensureDir(path.dirname(destinationPath));
      await fs.writeFile(destinationPath, data);
    }
  } catch (error) {
    await fs.remove(outputDir).catch(() => undefined);
    throw error;
  }

  return outputDir;
};

export const recordZipProcessingLocation = async ({
  uploadedZipPath,
  extractedPath,
  sourceType,
  sourceRef,
} = {}) => {
  await fs.ensureDir(jobsBaseDir);

  const now = Date.now();
  const record = {
    id: `zip-job-${now}`,
    createdAt: new Date(now).toISOString(),
    uploadedZipPath: uploadedZipPath || null,
    extractedPath: extractedPath || null,
    sourceType: sourceType || null,
    sourceRef: sourceRef || null,
  };

  const recordPath = path.join(jobsBaseDir, `${record.id}.json`);
  await fs.writeJson(recordPath, record, { spaces: 2 });

  return {
    ...record,
    recordPath,
  };
};

export const getZipProcessingRecordPath = (recordId) => {
  const safeId = String(recordId || "").trim();
  if (!safeId) {
    throw new Error("recordId is required");
  }

  if (!/^zip-job-\d+$/.test(safeId)) {
    throw new Error("Invalid ZIP processing record id");
  }


  return path.join(jobsBaseDir, `${safeId}.json`);
};

export const getZipProcessingRecord = async (recordId) => {
  const recordPath = getZipProcessingRecordPath(recordId);

  if (!(await fs.pathExists(recordPath))) {
    return null;
  }

  const record = await fs.readJson(recordPath);

  const uploadedZipPath = record?.uploadedZipPath
    ? path.resolve(record.uploadedZipPath)
    : null;
  const extractedPath = record?.extractedPath ? path.resolve(record.extractedPath) : null;

  return {
    ...record,
    uploadedZipPath:
      uploadedZipPath && isInsideRoot(path.resolve(uploadsBaseDir), uploadedZipPath)
        ? uploadedZipPath
        : null,
    extractedPath:
      extractedPath && isInsideRoot(path.resolve(extractedBaseDir), extractedPath)
        ? extractedPath
        : null,
    recordPath,
  };
};

export const compressDirectory = async (sourceDir, filePrefix = "fixed-project") => {
  if (!sourceDir) {
    throw new Error("sourceDir is required");
  }

  const safeSourceDir = resolvePathInsideBase(extractedBaseDir, sourceDir, "sourceDir");
  if (!(await fs.pathExists(safeSourceDir))) {
    throw new Error("sourceDir does not exist");
  }

  await fs.ensureDir(outputBaseDir);

  const safePrefix = String(filePrefix || "fixed-project").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const fileName = `${safePrefix}-${Date.now()}.zip`;
  const outputZipPath = path.join(outputBaseDir, fileName);

  const zip = new AdmZip();
  zip.addLocalFolder(safeSourceDir);
  zip.writeZip(outputZipPath);

  return outputZipPath;
};

export const createZipScanReportFile = async (reportData, filePrefix = "zip-scan-report") => {
  await fs.ensureDir(outputBaseDir);

  const safePrefix = String(filePrefix || "zip-scan-report").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const fileName = `${safePrefix}-${Date.now()}.json`;
  const outputReportPath = path.join(outputBaseDir, fileName);

  await fs.writeJson(outputReportPath, reportData, { spaces: 2 });

  return outputReportPath;
};

export const createZipScanReportPdf = async (reportData, filePrefix = "zip-scan-report") => {
  await fs.ensureDir(outputBaseDir);

  const safePrefix = String(filePrefix || "zip-scan-report").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const fileName = `${safePrefix}-${Date.now()}.pdf`;
  const outputPdfPath = path.join(outputBaseDir, fileName);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(outputPdfPath);

    doc.pipe(stream);

    doc.fontSize(18).text("ZIP Security Scan Report", { underline: true });
    doc.moveDown(0.6);
    doc.fontSize(11).text(`Generated At: ${reportData.generatedAt || new Date().toISOString()}`);
    doc.text(`Workflow: ${reportData.workflow || "zip-report-download"}`);
    doc.moveDown(0.8);

    if (reportData?.input) {
      doc.fontSize(13).text("Input Details", { underline: true });
      doc.fontSize(10);
      doc.text(`Uploaded File: ${reportData.input.uploadedFileName || "N/A"}`);
      doc.text(`Scan Session ID: ${reportData.input.scanSessionId || "N/A"}`);
      doc.moveDown(0.8);
    }

    if (reportData?.summary) {
      doc.fontSize(13).text("Summary", { underline: true });
      doc.fontSize(10);
      doc.text(`Total Findings: ${reportData.summary.totalFindings || 0}`);

      const severity = reportData.summary.severityBreakdown || {};
      doc.text(`Critical: ${severity.critical || 0}`);
      doc.text(`High: ${severity.high || 0}`);
      doc.text(`Medium: ${severity.medium || 0}`);
      doc.text(`Low: ${severity.low || 0}`);
      doc.moveDown(0.8);
    }

    const report = reportData?.vulnerabilityReport || {};
    doc.fontSize(13).text("Vulnerability Coverage", { underline: true });
    doc.fontSize(10).text(
      `Detected Types: ${report.detectedVulnerabilityTypes || 0} / ${report.totalCatalogVulnerabilities || 20}`
    );
    doc.text(`Total Occurrences: ${report.totalOccurrences || 0}`);
    doc.moveDown(0.6);

    const vulnerabilityRows = Array.isArray(report.vulnerabilities) ? report.vulnerabilities : [];
    const detectedRows = vulnerabilityRows.filter((row) => row?.detected);

    doc.fontSize(12).text("Detected Vulnerability Categories", { underline: true });
    doc.fontSize(10);

    if (!detectedRows.length) {
      doc.text("No catalog vulnerabilities detected.");
    } else {
      for (const row of detectedRows) {
        doc.text(`- ${row.name}: ${row.count}`);
      }
    }

    doc.moveDown(0.8);
    doc.fontSize(12).text("Top Findings (up to 25)", { underline: true });
    doc.fontSize(9);

    const findings = Array.isArray(reportData.findings) ? reportData.findings.slice(0, 25) : [];
    if (!findings.length) {
      doc.text("No findings available.");
    } else {
      for (const finding of findings) {
        const severity = String(finding?.severity || "low").toUpperCase();
        const title = finding?.title || "Untitled finding";
        const file = finding?.file || "unknown-file";
        const line = finding?.line || "?";
        doc.text(`- [${severity}] ${title} | ${file}:${line}`);
      }
    }

    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return outputPdfPath;
};
