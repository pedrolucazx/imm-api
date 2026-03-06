import postgres from "postgres";
import "dotenv/config";
import { logger } from "../src/core/config/logger.js";

const url = process.env.DATABASE_URL;
if (!url) {
  logger.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(url);

await sql`DROP SCHEMA public CASCADE`;
await sql`CREATE SCHEMA public`;
await sql`GRANT ALL ON SCHEMA public TO PUBLIC`;

logger.info("Database wiped. Run `npm run db:migrate` to recreate the schema.");
await sql.end();
