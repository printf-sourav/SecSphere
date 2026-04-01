import express from "express";
import { upload } from "../utils/multer.js";
import {
	handleApplyAllFixesToSession,
	handleApplyFixToCodebase,
	handleDownloadFixedZipFromSession,
	handleFixFeedback,
	handleFixZipAndReturn,
	handleZipReportDownload,
	handleScan,
} from "../controllers/scanController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

/**
 * @openapi
 * /api/scan:
 *   post:
 *     tags:
 *       - Scan
 *     summary: Scan a file, ZIP, or GitHub repository
 *     description: >-
 *       Upload a single file or ZIP archive using multipart/form-data, or provide
 *       a GitHub repository URL using JSON. Returns top findings, summary, and score.
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Source file or ZIP archive to scan.
 *               repoUrl:
 *                 type: string
 *                 example: https://github.com/octocat/Hello-World
 *                 description: Optional GitHub repository URL.
 *               projectType:
 *                 type: string
 *                 example: banking
 *                 description: Optional project domain hint (banking, e-commerce, healthcare, saas).
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repoUrl:
 *                 type: string
 *                 example: https://github.com/octocat/Hello-World
 *               projectType:
 *                 type: string
 *                 example: e-commerce
 *     responses:
 *       200:
 *         description: Scan completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScanSuccessResponse'
 *       400:
 *         description: Invalid request input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

router.post("/scan", upload.single("file"), asyncHandler(handleScan));

/**
 * @openapi
 * /api/feedback/fix:
 *   post:
 *     tags:
 *       - Scan
 *     summary: Record an applied fix for learning
 *     description: >-
 *       Stores user-approved remediation so future AI recommendations can
 *       prioritize proven fixes for similar vulnerabilities.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FixFeedbackRequest'
 *     responses:
 *       200:
 *         description: Feedback recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FixFeedbackResponse'
 *       400:
 *         description: Invalid payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

router.post("/feedback/fix", asyncHandler(handleFixFeedback));

router.post("/fix/session/apply-all", asyncHandler(handleApplyAllFixesToSession));
router.post("/fix/apply", asyncHandler(handleApplyFixToCodebase));
router.post("/fix/session/download", asyncHandler(handleDownloadFixedZipFromSession));
router.post("/fix/zip", upload.single("file"), asyncHandler(handleFixZipAndReturn));
router.post("/fix/zip/report", upload.single("file"), asyncHandler(handleZipReportDownload));

export default router;