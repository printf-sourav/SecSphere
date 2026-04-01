import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "uploads");
fs.ensureDirSync(uploadDir);

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

// File filter (optional but good)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [".js", ".json", ".zip", ".txt"];

  const originalName = String(file.originalname || "");
  const ext = path.extname(originalName).toLowerCase();

  if (/\.(php|exe|js|py|sh|bat)\./i.test(originalName)) {
    cb(new Error("Suspicious double extension"), false);
    return;
  }

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
    fileSize: 5 * 1024 * 1024,
  },
});