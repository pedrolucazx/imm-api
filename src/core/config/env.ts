import { config } from "dotenv";
import { z } from "zod";
import { logger } from "./logger.js";
import { existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath, quiet: true });
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test", "homolog"]).default("development"),
    PORT: z.coerce.number().default(3001),
    API_HOST: z.string().default("localhost:3001"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters" }),
    JWT_ACCESS_EXPIRES: z.string().default("15m"),
    JWT_REFRESH_EXPIRES: z.string().default("7d"),

    // Provider selection
    AI_PROVIDER: z
      .string()
      .default("gemini")
      .refine(
        (v) =>
          v
            .split(",")
            .map((p) => p.trim())
            .every((p) => ["gemini"].includes(p)),
        "AI_PROVIDER must be one of: gemini"
      ),
    TRANSCRIPTION_PROVIDER: z
      .string()
      .default("gemini")
      .refine(
        (v) =>
          v
            .split(",")
            .map((p) => p.trim())
            .every((p) => ["gemini"].includes(p)),
        "TRANSCRIPTION_PROVIDER must be one of: gemini"
      ),
    STORAGE_PROVIDER: z
      .string()
      .default("supabase")
      .refine(
        (v) =>
          v
            .split(",")
            .map((p) => p.trim())
            .every((p) => ["supabase"].includes(p)),
        "STORAGE_PROVIDER must be one of: supabase"
      ),

    // Gemini (required if AI_PROVIDER or TRANSCRIPTION_PROVIDER includes "gemini")
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_API_URL: z
      .url()
      .default(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
      ),

    // Supabase Storage (required if STORAGE_PROVIDER includes "supabase")
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("avatars"),
    SUPABASE_AUDIO_BUCKET: z.string().default("audio-entries"),

    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_TIMEWINDOW: z.coerce.number().int().positive().default(60000),
    RESEND_API_KEY: z.string().min(1),
    APP_URL: z.string().url().default("http://localhost:3000"),
  })
  .superRefine((data, ctx) => {
    const usesGemini =
      data.AI_PROVIDER.split(",")
        .map((p) => p.trim())
        .includes("gemini") ||
      data.TRANSCRIPTION_PROVIDER.split(",")
        .map((p) => p.trim())
        .includes("gemini");

    if (usesGemini && !data.GEMINI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message:
          "GEMINI_API_KEY is required when AI_PROVIDER or TRANSCRIPTION_PROVIDER includes gemini",
        path: ["GEMINI_API_KEY"],
      });
    }

    const usesSupabase = data.STORAGE_PROVIDER.split(",")
      .map((p) => p.trim())
      .includes("supabase");

    if (usesSupabase && !data.SUPABASE_URL) {
      ctx.addIssue({
        code: "custom",
        message: "SUPABASE_URL is required when STORAGE_PROVIDER=supabase",
        path: ["SUPABASE_URL"],
      });
    }

    if (usesSupabase && !data.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "SUPABASE_SERVICE_ROLE_KEY is required when STORAGE_PROVIDER=supabase",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.error("❌ Invalid environment variables:");
  logger.error(z.prettifyError(parsedEnv.error));
  process.exit(1);
}

const usesGemini =
  parsedEnv.data.AI_PROVIDER.split(",")
    .map((p) => p.trim())
    .includes("gemini") ||
  parsedEnv.data.TRANSCRIPTION_PROVIDER.split(",")
    .map((p) => p.trim())
    .includes("gemini");

if (
  usesGemini &&
  !["development", "test"].includes(parsedEnv.data.NODE_ENV) &&
  new URL(parsedEnv.data.GEMINI_API_URL).protocol !== "https:"
) {
  logger.error("❌ GEMINI_API_URL must use HTTPS");
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
};
