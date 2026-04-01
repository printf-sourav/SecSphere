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
            id: { type: "string", example: "VULN-001" },
            title: { type: "string", example: "Unsafe eval usage" },
            severity: { type: "string", example: "high" },
            type: { type: "string", example: "code" },
            category: { type: "string", example: "semgrep" },
            detector: { type: "string", example: "semgrep" },
            file: { type: "string", example: "src/app.js" },
            line: { type: "integer", example: 42 },
            existsAt: { type: "string", example: "src/app.js:42" },
            location: {
              type: "object",
              properties: {
                file: { type: "string", example: "src/app.js" },
                line: { type: "integer", example: 42 },
                existsAt: { type: "string", example: "src/app.js:42" },
              },
            },
            description: {
              type: "string",
              example: "Avoid eval because it can execute untrusted input.",
            },
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
                  fix: { type: "string" },
                },
              },
            },
          },
        },
        ScanAnalytics: {
          type: "object",
          properties: {
            scanId: { type: "string" },
            durationMs: { type: "number", example: 12450 },
            durationSec: { type: "number", example: 12.5 },
            scannedFiles: { type: "integer", example: 152 },
            fileLimitReached: { type: "boolean", example: false },
            sourceType: { type: "string", example: "Repo" },
            sourceLabel: { type: "string", example: "my-repo" },
            counts: {
              type: "object",
              properties: {
                total: { type: "integer", example: 4 },
                crit: { type: "integer", example: 1 },
                high: { type: "integer", example: 1 },
                med: { type: "integer", example: 1 },
                low: { type: "integer", example: 1 },
                code: { type: "integer", example: 2 },
                cloud: { type: "integer", example: 1 },
                iam: { type: "integer", example: 1 },
                aiFixes: { type: "integer", example: 4 },
              },
            },
            categoryBreakdown: {
              type: "object",
              additionalProperties: { type: "integer" },
            },
            issueLocations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  severity: { type: "string" },
                  type: { type: "string" },
                  category: { type: "string" },
                  detector: { type: "string" },
                  file: { type: "string" },
                  line: { type: "integer" },
                  existsAt: { type: "string" },
                },
              },
            },
            scanStatus: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  status: { type: "string", example: "done" },
                },
              },
            },
            toolStatus: {
              type: "object",
              properties: {
                semgrep: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    reason: { type: "string" },
                  },
                },
                trivy: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    reason: { type: "string" },
                  },
                },
              },
            },
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "string" },
                  at: { type: "string", format: "date-time" },
                  message: { type: "string" },
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
                analytics: {
                  $ref: "#/components/schemas/ScanAnalytics",
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
