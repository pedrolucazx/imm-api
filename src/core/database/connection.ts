import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

let cachedUrl: string | undefined;
let cachedClient: ReturnType<typeof postgres> | undefined;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  const url = process.env.DATABASE_URL!;
  if (!cachedDb || cachedUrl !== url) {
    if (cachedClient && cachedUrl && cachedUrl !== url) {
      void cachedClient.end();
    }
    cachedUrl = url;
    cachedClient = postgres(url);
    cachedDb = drizzle(cachedClient, { schema });
  }
  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.end();
    cachedClient = undefined;
    cachedDb = undefined;
    cachedUrl = undefined;
  }
}
