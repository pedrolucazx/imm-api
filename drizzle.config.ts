import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const selectedEnvFile = process.env.DRIZZLE_ENV_FILE ?? ".env";
const selectedEnvPath = resolve(process.cwd(), selectedEnvFile);

if (existsSync(selectedEnvPath)) {
  config({ path: selectedEnvPath, quiet: true, override: true });
}

export default defineConfig({
  schema: "./src/core/database/schema/*.schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev",
  },
});
