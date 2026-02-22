import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/core/database/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev",
  },
});
