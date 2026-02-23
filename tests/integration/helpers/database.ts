import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/core/database/schema/index.js";

export interface TestDatabase {
  db: PostgresJsDatabase<typeof schema>;
  connectionUri: string;
  teardown: () => Promise<void>;
}

export async function setupTestDatabase(): Promise<TestDatabase> {
  // Use the existing Docker PostgreSQL instead of testcontainers
  const connectionUri =
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev";

  const client = postgres(connectionUri, { max: 1 });
  const db = drizzle(client, { schema });

  // Ensure migrations are up to date
  await migrate(db, { migrationsFolder: "./src/migrations" });

  return {
    db,
    connectionUri,
    teardown: async () => {
      await client.end();
    },
  };
}
