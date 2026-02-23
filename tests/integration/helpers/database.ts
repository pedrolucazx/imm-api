import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/core/database/schema/index.js";

export interface TestDatabase {
  db: PostgresJsDatabase<typeof schema>;
  container?: StartedPostgreSqlContainer;
  connectionUri: string;
  teardown: () => Promise<void>;
}

export async function setupTestDatabase(): Promise<TestDatabase> {
  // In CI environment, use testcontainers for full isolation
  // In local dev, can fallback to existing Docker PostgreSQL for speed
  const useTestcontainers = process.env.CI === "true" || !process.env.DATABASE_URL;

  let container: StartedPostgreSqlContainer | undefined;
  let connectionUri: string;

  if (useTestcontainers) {
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("imm_test")
      .withUsername("postgres")
      .withPassword("postgres")
      .start();

    connectionUri = container.getConnectionUri();
  } else {
    // Fallback to existing database for local development speed
    connectionUri = process.env.DATABASE_URL!;
  }

  const client = postgres(connectionUri, { max: 1 });
  const db = drizzle(client, { schema });

  // Ensure migrations are up to date
  await migrate(db, { migrationsFolder: "./src/migrations" });

  return {
    db,
    container,
    connectionUri,
    teardown: async () => {
      await client.end();
      if (container) {
        await container.stop();
      }
    },
  };
}
