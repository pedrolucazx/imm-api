import { config } from "dotenv";
import { z } from "zod";
import { logger } from "./logger.js";
import { existsSync } from "fs";
import { resolve } from "path";

const envFiles = [".env.local", ".env"];
for (const file of envFiles) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    config({ path, quiet: true });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "homolog"]).default("development"),
  PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("localhost:3001"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters" }),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  ANTHROPIC_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIMEWINDOW: z.coerce.number().int().positive().default(60000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.error("❌ Invalid environment variables:");
  logger.error(z.prettifyError(parsedEnv.error));
  process.exit(1);
}

export const env = parsedEnv.data;
