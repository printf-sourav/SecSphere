import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import AdmZip from "adm-zip";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const extractedBaseDir = path.join(backendRoot, "src", "temp", "extracted");
const jobsBaseDir = path.join(backendRoot, "src", "temp", "jobs");
const outputBaseDir = path.join(backendRoot, "src", "temp", "output");

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

export const recordZipProcessingLocation = async ({
  uploadedZipPath,
  extractedPath,
} = {}) => {
  await fs.ensureDir(jobsBaseDir);

  const now = Date.now();
  const record = {
    id: `zip-job-${now}`,
    createdAt: new Date(now).toISOString(),
    uploadedZipPath: uploadedZipPath || null,
    extractedPath: extractedPath || null,
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
  return {
    ...record,
    recordPath,
  };
};

export const compressDirectory = async (sourceDir, filePrefix = "fixed-project") => {
  if (!sourceDir) {
    throw new Error("sourceDir is required");
  }

  await fs.ensureDir(outputBaseDir);

  const safePrefix = String(filePrefix || "fixed-project").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const fileName = `${safePrefix}-${Date.now()}.zip`;
  const outputZipPath = path.join(outputBaseDir, fileName);

  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
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
      doc.text(`Uploaded ZIP Path: ${reportData.input.uploadedZipPath || "N/A"}`);
      doc.text(`Extracted Path: ${reportData.input.extractedPath || "N/A"}`);
      doc.text(`Tracking Record: ${reportData.input.trackingRecordPath || "N/A"}`);
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
