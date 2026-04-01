import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import scanRoutes from "./src/routes/scan.js";
import { swaggerSpec } from "./src/config/swagger.js";

const app = express();

app.use(cors());
app.use(express.json());

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

// Global error handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    data: null,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
  });
});

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});