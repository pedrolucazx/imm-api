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
  const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const useTestcontainers = isCI || !process.env.DATABASE_URL;

  let container: StartedPostgreSqlContainer | undefined;
  let connectionUri: string;

  if (useTestcontainers) {
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("imm_test")
      .withUsername("postgres")
      .withPassword("postgres")
      .withStartupTimeout(120000) // 2 minutes timeout for CI
      .withReuse() // local: mantém o container vivo entre runs, evita cold start toda hora
      .start();

    connectionUri = container.getConnectionUri();
  } else {
    // Fallback to existing database for local development speed
    connectionUri = process.env.DATABASE_URL!;
  }

  const client = postgres(connectionUri, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });

  // Ensure migrations are up to date
  await migrate(db, { migrationsFolder: "./src/migrations" });

  // migrate() only applies schema — com container reusado (.withReuse()) ou
  // DATABASE_URL de dev apontando pra um banco persistente, dado de uma
  // execução anterior sobrevive. Trunca tudo pra cada run começar limpo.
  await client.unsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '__drizzle_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);

  return {
    db,
    container,
    connectionUri,
    teardown: async () => {
      await client.end();
      if (container) {
        // remove: false — não anula o .withReuse(): sem isso, stop() apaga
        // o container por padrão e a próxima run nunca reaproveita nada.
        await container.stop({ remove: false });
      }
    },
  };
}
