import request from "supertest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildTestApp } from "./helpers/app.js";
import { closeDb, getDb } from "@/core/database/connection.js";
import { users } from "@/core/database/schema/users.schema.js";
import { onboardingSessions } from "@/core/database/schema/onboarding-sessions.schema.js";
import { setupTestDatabase, type TestDatabase } from "../integration/helpers/database.js";
import { verifyEmailInDb } from "./helpers/db.js";

describe("Onboarding endpoints", () => {
  let app: FastifyInstance | undefined;
  let testDb: TestDatabase | undefined;
  let accessToken: string;
  let userId: string;
  let previousDatabaseUrl: string | undefined;

  const uniqueEmail = `onboarding-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;

  beforeAll(async () => {
    previousDatabaseUrl = process.env.DATABASE_URL;
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;
    app = await buildTestApp();

    await request(app.server)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "Password1!", name: "Onboarding User" })
      .expect(201);

    await verifyEmailInDb(uniqueEmail);

    const loginRes = await request(app.server)
      .post("/api/auth/login")
      .send({ email: uniqueEmail, password: "Password1!" })
      .expect(200);

    accessToken = loginRes.body.token;
    userId = loginRes.body.user.id;
  }, 120000);

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      try {
        const db = getDb();
        await db.delete(users);
        await closeDb();
      } finally {
        if (previousDatabaseUrl === undefined) {
          delete process.env.DATABASE_URL;
        } else {
          process.env.DATABASE_URL = previousDatabaseUrl;
        }
        if (testDb) await testDb.teardown();
      }
    }
  });

  describe("GET /api/users/me/onboarding", () => {
    it("returns 401 without token", async () => {
      await request(app!.server).get("/api/users/me/onboarding").expect(401);
    });

    it("returns default status for new user (session created at register)", async () => {
      const res = await request(app!.server)
        .get("/api/users/me/onboarding")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        currentStep: 0,
        skipped: false,
        completed: false,
        completedAt: null,
      });
    });

    it("register creates onboarding_session automatically", async () => {
      const db = getDb();
      const [session] = await db
        .select()
        .from(onboardingSessions)
        .where(eq(onboardingSessions.userId, userId));

      expect(session).toBeDefined();
      expect(session.currentStep).toBe(0);
      expect(session.skipped).toBe(false);
      expect(session.completed).toBe(false);
    });
  });

  describe("PUT /api/users/me/onboarding", () => {
    it("returns 401 without token", async () => {
      await request(app!.server)
        .put("/api/users/me/onboarding")
        .send({ currentStep: 1 })
        .expect(401);
    });

    it("updates currentStep", async () => {
      const res = await request(app!.server)
        .put("/api/users/me/onboarding")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentStep: 2 })
        .expect(200);

      expect(res.body.currentStep).toBe(2);
      expect(res.body.completed).toBe(false);
    });

    it("sets completed=true and populates completedAt", async () => {
      const res = await request(app!.server)
        .put("/api/users/me/onboarding")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ completed: true })
        .expect(200);

      expect(res.body.completed).toBe(true);
      expect(res.body.completedAt).not.toBeNull();
      expect(typeof res.body.completedAt).toBe("string");
    });

    it("can reset tour (completed=false, skipped=false, currentStep=0)", async () => {
      const res = await request(app!.server)
        .put("/api/users/me/onboarding")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ completed: false, skipped: false, currentStep: 0 })
        .expect(200);

      expect(res.body.currentStep).toBe(0);
      expect(res.body.completed).toBe(false);
      expect(res.body.skipped).toBe(false);
    });

    it("saves skipped=true", async () => {
      const res = await request(app!.server)
        .put("/api/users/me/onboarding")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ skipped: true })
        .expect(200);

      expect(res.body.skipped).toBe(true);
    });

    it("rejects invalid currentStep (out of range)", async () => {
      await request(app!.server)
        .put("/api/users/me/onboarding")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentStep: 99 })
        .expect(400); // Fastify JSON schema validation returns 400
    });
  });
});
