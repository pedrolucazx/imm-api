import postgres from "postgres";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(url);

await sql`DROP SCHEMA public CASCADE`;
await sql`CREATE SCHEMA public`;
await sql`GRANT ALL ON SCHEMA public TO PUBLIC`;

console.log("Database wiped. Run `npm run db:migrate` to recreate the schema.");
await sql.end();
