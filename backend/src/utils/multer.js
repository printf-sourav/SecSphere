import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { randomBytes } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "uploads");
fs.ensureDirSync(uploadDir);
const MAX_UPLOAD_FILE_BYTES = Number(process.env.MAX_UPLOAD_FILE_BYTES || 25 * 1024 * 1024);

const sanitizeOriginalName = (value) => {
  const base = path.basename(String(value || "upload.bin"));
  const normalized = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.slice(0, 120) || "upload.bin";
};

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = sanitizeOriginalName(file.originalname);
    const uniqueToken = randomBytes(6).toString("hex");
    const uniqueName = `${Date.now()}-${uniqueToken}-${safeName}`;
    cb(null, uniqueName);
  },
});

// File filter (optional but good)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [".js", ".json", ".zip", ".txt"];

  const ext = path.extname(sanitizeOriginalName(file.originalname)).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 1,
    fileSize: MAX_UPLOAD_FILE_BYTES,
  },
});