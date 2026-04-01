import "dotenv/config";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

const extractRegionFromArn = (value) => {
  const arn = String(value || "").trim();
  if (!arn.startsWith("arn:")) {
    return "";
  }

  const parts = arn.split(":");
  return String(parts[3] || "").trim();
};

const configuredBedrockTarget =
  process.env.BEDROCK_INFERENCE_PROFILE_ARN ||
  process.env.BEDROCK_INFERENCE_PROFILE_ID ||
  process.env.BEDROCK_MODEL_ID ||
  "";

const inferredRegionFromTarget = extractRegionFromArn(configuredBedrockTarget);

export const awsRegion =
  inferredRegionFromTarget ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";

export const bedrockModelId =
  configuredBedrockTarget || "anthropic.claude-sonnet-4-5-20250929-v1:0";

export const bedrockTimeoutMs = Number(process.env.BEDROCK_TIMEOUT_MS || 8000);

export const bedrockClient = new BedrockRuntimeClient({ region: awsRegion });
