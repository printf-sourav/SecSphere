import path from "path";
import { fileURLToPath } from "url";
import swaggerJSDoc from "swagger-jsdoc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Cloud Security Scanner API",
      version: "1.0.0",
      description:
        "API documentation for testing file, ZIP, and GitHub repository scans.",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
    ],
    tags: [
      {
        name: "Scan",
        description: "Security scan operations",
      },
    ],
    components: {
      schemas: {
        ScanIssue: {
          type: "object",
          properties: {
            title: { type: "string", example: "Unsafe eval usage" },
            severity: { type: "string", example: "high" },
            file: { type: "string", example: "src/app.js" },
            line: { type: "integer", example: 42 },
            explanation: {
              type: "string",
              example: "Dynamic execution can allow arbitrary code injection.",
            },
            fix: {
              type: "string",
              example: "Remove eval and use safe parsing/validation.",
            },
            learningHints: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  vulnerability: { type: "string" },
                  source: { type: "string", example: "user-learned" },
                  usageCount: { type: "integer", example: 3 },
                },
              },
            },
          },
        },
        ProjectContext: {
          type: "object",
          properties: {
            domain: { type: "string", example: "e-commerce" },
            impact: { type: "string", example: "high" },
            confidence: { type: "number", example: 0.78 },
            rationale: {
              type: "string",
              example: "Matched context keywords: checkout, cart, payment.",
            },
          },
        },
        ScanSuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Scan completed" },
            data: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ScanIssue" },
                },
                summary: {
                  type: "string",
                  example: "No vulnerabilities found",
                },
                score: { type: "integer", example: 100 },
                predictedScore: { type: "integer", example: 74 },
                riskBand: { type: "string", example: "moderate" },
                riskModel: { type: "string", example: "linear-risk-v1" },
                projectContext: {
                  $ref: "#/components/schemas/ProjectContext",
                },
                bestPractices: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
        FixFeedbackRequest: {
          type: "object",
          required: ["vulnerability", "fix"],
          properties: {
            vulnerability: {
              type: "string",
              example: "SQL Injection in login query",
            },
            fix: {
              type: "string",
              example: "Use prepared statements with parameter binding.",
            },
            projectType: {
              type: "string",
              example: "banking",
            },
            file: {
              type: "string",
              example: "src/auth/login.js",
            },
            notes: {
              type: "string",
              example: "Validated by secure code review.",
            },
          },
        },
        FixFeedbackResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Fix feedback recorded" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                vulnerability: { type: "string" },
                projectType: { type: "string" },
                usageCount: { type: "integer", example: 2 },
                firstAppliedAt: { type: "string", format: "date-time" },
                lastAppliedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            data: { type: "null", example: null },
            message: { type: "string", example: "No input provided" },
            errors: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, "../routes/*.js")],
};

export const swaggerSpec = swaggerJSDoc(options);
