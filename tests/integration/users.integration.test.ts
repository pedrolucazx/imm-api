import { eq } from "drizzle-orm";
import { hashPassword } from "@/shared/utils/password.js";
import { users } from "@/core/database/schema/index.js";
import { setupTestDatabase, type TestDatabase } from "./helpers/database.js";

describe("Users — database integration", () => {
  let testDb: TestDatabase | undefined;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  }, 60000); // 60s timeout for Testcontainers to download/start PostgreSQL in CI

  afterAll(async () => {
    if (testDb) await testDb.teardown();
  });

  it("inserts and retrieves a user", async () => {
    const { db } = testDb!;
    const passwordHash = await hashPassword("password123");
    const uniqueEmail = `integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;

    const [created] = await db
      .insert(users)
      .values({
        email: uniqueEmail,
        name: "Integration User",
        passwordHash,
      })
      .returning();

    expect(created.id).toBeDefined();
    expect(created.email).toBe(uniqueEmail);

    const [found] = await db.select().from(users).where(eq(users.email, uniqueEmail));

    expect(found.id).toBe(created.id);
    expect(found.name).toBe("Integration User");
  });

  it("enforces email uniqueness", async () => {
    const { db } = testDb!;
    const passwordHash = await hashPassword("password123");

    const firstEmail = `unique-first-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    await db.insert(users).values({
      email: firstEmail,
      name: "First User",
      passwordHash,
    });

    await expect(
      db.insert(users).values({
        email: firstEmail, // Same email to trigger duplicate error
        name: "Duplicate User",
        passwordHash,
      })
    ).rejects.toThrow();
  });
});
