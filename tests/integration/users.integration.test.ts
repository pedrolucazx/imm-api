import { eq } from "drizzle-orm";
import { hashPassword } from "@/shared/utils/password.js";
import { users } from "@/core/database/schema/index.js";
import { setupTestDatabase, type TestDatabase } from "./helpers/database.js";

/**
 * Integration tests run against a real PostgreSQL database
 * spun up via Testcontainers. Each test suite gets its own
 * isolated container so tests never share state.
 */

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await setupTestDatabase();
});

afterAll(async () => {
  await testDb.teardown();
});

describe("Users — database integration", () => {
  it("should insert and retrieve a user", async () => {
    const { db } = testDb;
    const passwordHash = await hashPassword("password123");

    const [created] = await db
      .insert(users)
      .values({
        email: "integration@example.com",
        name: "Integration User",
        passwordHash,
      })
      .returning();

    expect(created.id).toBeDefined();
    expect(created.email).toBe("integration@example.com");

    const [found] = await db.select().from(users).where(eq(users.email, "integration@example.com"));

    expect(found.id).toBe(created.id);
    expect(found.name).toBe("Integration User");
  });

  it("should enforce email uniqueness", async () => {
    const { db } = testDb;
    const passwordHash = await hashPassword("password123");

    await db.insert(users).values({
      email: "unique@example.com",
      name: "First User",
      passwordHash,
    });

    await expect(
      db.insert(users).values({
        email: "unique@example.com",
        name: "Duplicate User",
        passwordHash,
      })
    ).rejects.toThrow();
  });
});
