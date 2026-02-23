import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

let cachedUrl: string | undefined;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  const url = process.env.DATABASE_URL!;
  if (!cachedDb || cachedUrl !== url) {
    cachedUrl = url;
    cachedDb = drizzle(postgres(url), { schema });
  }
  return cachedDb;
}
