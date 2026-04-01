import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

export const awsRegion =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

export const bedrockModelId =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

export const bedrockTimeoutMs = Number(process.env.BEDROCK_TIMEOUT_MS || 8000);

export const bedrockClient = new BedrockRuntimeClient({ region: awsRegion });
