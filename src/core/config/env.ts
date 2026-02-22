import { config } from "dotenv";
import { z } from "zod";
import { logger } from "./logger.js";

// Load environment variables from .env file
config();

// Define the schema for environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("localhost:3001"),
  DATABASE_URL: z.string().url().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ANTHROPIC_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
});

// Validate and parse environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.error("❌ Invalid environment variables:");
  logger.error(parsedEnv.error.format());
  process.exit(1);
}

// Export validated and typed environment variables
export const env = parsedEnv.data;
