import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";
import { logger } from "../config/logger.js";

let cachedUrl: string | undefined;
let cachedClient: ReturnType<typeof postgres> | undefined;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
export type DbTransaction = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];
export type DbClient = DrizzleDb | DbTransaction;

export function getDb(): DrizzleDb {
  const url = process.env.DATABASE_URL!;

  if (cachedDb && cachedUrl === url) return cachedDb;

  if (cachedClient) {
    void cachedClient.end().catch((err) => {
      logger.error(err, "Failed to close previous Postgres connection");
    });
  }

  cachedUrl = url;
  const isTest = process.env.NODE_ENV === "test";
  cachedClient = postgres(url, {
    onnotice: isTest ? () => {} : undefined,
  });
  cachedDb = drizzle(cachedClient, { schema });

  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (!cachedClient) return;

  const client = cachedClient;
  cachedClient = undefined;
  cachedDb = undefined;
  cachedUrl = undefined;

  await client.end();
}
