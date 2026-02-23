import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/core/database/schema/index.js";

export interface TestDatabase {
  db: PostgresJsDatabase<typeof schema>;
  container: StartedPostgreSqlContainer;
  connectionUri: string;
  teardown: () => Promise<void>;
}

export async function setupTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("imm_test")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  const connectionUri = container.getConnectionUri();
  const client = postgres(connectionUri, { max: 1 });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "./src/migrations" });

  return {
    db,
    container,
    connectionUri,
    teardown: async () => {
      await client.end();
      await container.stop();
    },
  };
}
