import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import scanRoutes from "./src/routes/scan.js";
import { swaggerSpec } from "./src/config/swagger.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5000);
const FRONTEND_DIST_PATH = path.resolve(__dirname, "../Frontend/dist");
const frontendOrigins = String(process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ""))
  .filter(Boolean);

const allowLocalhostCors =
  String(
    process.env.ALLOW_LOCALHOST_CORS ||
      (process.env.NODE_ENV !== "production" ? "true" : "false")
  ).toLowerCase() === "true";

const isLocalDevOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server/cURL requests without Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = String(origin).replace(/\/$/, "");

      if (frontendOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      if (allowLocalhostCors && isLocalDevOrigin(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
    },
    message: "Backend is healthy",
  });
});

app.get("/api-docs.json", (req, res) => {
  res.json(swaggerSpec);
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Cloud Security Scanner API Docs",
  })
);

// Routes
app.use("/api", scanRoutes);

if (fs.existsSync(FRONTEND_DIST_PATH)) {
  app.use(express.static(FRONTEND_DIST_PATH));

  // SPA fallback for non-API routes when frontend build exists.
  app.get(/^(?!\/api(?:\/|$)|\/api-docs(?:\/|$)|\/api-docs\.json$).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_PATH, "index.html"));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    data: null,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});