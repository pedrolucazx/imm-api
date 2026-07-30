import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import { logger } from "./logger.js";

const SSM_SECRET_KEYS = ["DATABASE_URL", "GEMINI_API_KEY"] as const;

// Only in production — local/test keep reading straight from .env. Falls back
// to whatever's already in process.env (from .env) on any SSM failure, so a
// missing/broken permission degrades to the old behavior instead of crashing
// the boot — same reasoning as the presigned-url Lambda's JWT_SECRET fetch.
// Must run (and be awaited) before env.js is imported, since that module
// parses process.env synchronously at import time.
export async function loadSecretsFromSsm(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  try {
    const ssm = new SSMClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const { Parameters } = await ssm.send(
      new GetParametersCommand({
        Names: SSM_SECRET_KEYS.map((key) => `/imm/production/${key}`),
        WithDecryption: true,
      })
    );
    for (const param of Parameters ?? []) {
      const key = param.Name?.split("/").pop();
      if (key && param.Value) process.env[key] = param.Value;
    }
  } catch (err) {
    logger.warn({ err }, "Failed to load secrets from SSM, falling back to .env");
  }
}
