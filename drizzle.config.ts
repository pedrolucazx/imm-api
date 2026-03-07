import { defineConfig } from "drizzle-kit";
import { env } from "./src/core/config/env.js";

export default defineConfig({
  schema: "./src/core/database/schema/*.schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev",
  },
});
