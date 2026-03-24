import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/app.js";
import { closeDb, getDb } from "@/core/database/connection.js";
import { habits } from "@/core/database/schema/habits.schema.js";
import { habitLogs } from "@/core/database/schema/habit-logs.schema.js";
import { setupTestDatabase, type TestDatabase } from "../integration/helpers/database.js";
import { verifyEmailInDb } from "./helpers/db.js";

const BASE_HABIT = {
  name: "Meditar",
  icon: "🧘",
  color: "#6366f1",
  frequency: "daily",
  targetDays: 7,
};

async function registerAndLogin(
  app: FastifyInstance,
  suffix: string
): Promise<{ token: string; userId: string }> {
  const email = `habits-e2e-${suffix}-${Date.now()}@example.com`;
  await request(app.server)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "Habits User" })
    .expect(201);

  await verifyEmailInDb(email);

  const res = await request(app.server)
    .post("/api/auth/login")
    .send({ email, password: "password123" })
    .expect(200);

  expect(res.body.token).toBeDefined();
  expect(res.body.user?.id).toBeDefined();
  return { token: res.body.token, userId: res.body.user.id };
}

describe("Habits API — E2E", () => {
  let app: FastifyInstance | undefined;
  let testDb: TestDatabase | undefined;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;
    app = await buildTestApp();
  }, 120000);

  beforeEach(async () => {
    const db = getDb();
    await db.delete(habitLogs);
    await db.delete(habits);
  });

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      await closeDb();
      if (testDb) await testDb.teardown();
    }
  });

  describe("GET /habits", () => {
    it("returns empty array when user has no habits", async () => {
      const { token } = await registerAndLogin(app!, "list-empty");
      const res = await request(app!.server)
        .get("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it("returns only habits belonging to the authenticated user", async () => {
      const { token: token1 } = await registerAndLogin(app!, "list-owner1");
      const { token: token2 } = await registerAndLogin(app!, "list-owner2");

      await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token1}`)
        .send(BASE_HABIT);

      const res = await request(app!.server)
        .get("/api/habits")
        .set("Authorization", `Bearer ${token2}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it("returns 401 without token", async () => {
      await request(app!.server).get("/api/habits").expect(401);
    });
  });

  describe("GET /habits/:id", () => {
    it("returns the habit for its owner", async () => {
      const { token } = await registerAndLogin(app!, "getbyid");
      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      const res = await request(app!.server)
        .get(`/api/habits/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.name).toBe("Meditar");
    });

    it("returns 404 when accessing another user's habit", async () => {
      const { token: token1 } = await registerAndLogin(app!, "forbidden-owner");
      const { token: token2 } = await registerAndLogin(app!, "forbidden-other");

      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token1}`)
        .send(BASE_HABIT)
        .expect(201);

      await request(app!.server)
        .get(`/api/habits/${created.body.id}`)
        .set("Authorization", `Bearer ${token2}`)
        .expect(404);
    });

    it("returns 404 for unknown id", async () => {
      const { token } = await registerAndLogin(app!, "getbyid-notfound");
      await request(app!.server)
        .get("/api/habits/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });

  describe("POST /habits", () => {
    it("creates a habit and returns 201", async () => {
      const { token } = await registerAndLogin(app!, "create");
      const res = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Meditar");
      expect(res.body.isActive).toBe(true);
    });

    it("returns 422 when the active habits limit is reached", async () => {
      const { token } = await registerAndLogin(app!, "limit");

      for (let i = 0; i < 5; i++) {
        await request(app!.server)
          .post("/api/habits")
          .set("Authorization", `Bearer ${token}`)
          .send({ ...BASE_HABIT, name: `Hábito ${i}` })
          .expect(201);
      }

      const res = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...BASE_HABIT, name: "6th habit" })
        .expect(422);

      expect(res.body.error).toMatch(/limit/i);
    });
  });

  describe("PATCH /habits/:id", () => {
    it("updates a habit and returns 200", async () => {
      const { token } = await registerAndLogin(app!, "update");
      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      const res = await request(app!.server)
        .patch(`/api/habits/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Meditação diária" })
        .expect(200);

      expect(res.body.name).toBe("Meditação diária");
    });

    it("returns 404 when updating another user's habit", async () => {
      const { token: token1 } = await registerAndLogin(app!, "patch-owner");
      const { token: token2 } = await registerAndLogin(app!, "patch-other");

      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token1}`)
        .send(BASE_HABIT)
        .expect(201);

      await request(app!.server)
        .patch(`/api/habits/${created.body.id}`)
        .set("Authorization", `Bearer ${token2}`)
        .send({ name: "Hacked" })
        .expect(404);
    });
  });

  describe("DELETE /habits/:id", () => {
    it("soft-deletes a habit and returns 204", async () => {
      const { token } = await registerAndLogin(app!, "delete");
      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      await request(app!.server)
        .delete(`/api/habits/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      const res = await request(app!.server)
        .get(`/api/habits/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  describe("POST /habits/:id/log — check-in", () => {
    it("records a check-in and returns 200", async () => {
      const { token } = await registerAndLogin(app!, "checkin");
      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      const res = await request(app!.server)
        .post(`/api/habits/${created.body.id}/log`)
        .set("Authorization", `Bearer ${token}`)
        .send({ logDate: "2026-03-12", completed: true })
        .expect(200);

      expect(res.body.habitId).toBe(created.body.id);
      expect(res.body.logDate).toBe("2026-03-12");
      expect(res.body.completed).toBe(true);
    });

    it("is idempotent — calling twice returns same result", async () => {
      const { token } = await registerAndLogin(app!, "checkin-idem");
      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      const payload = { logDate: "2026-03-12", completed: true };
      const first = await request(app!.server)
        .post(`/api/habits/${created.body.id}/log`)
        .set("Authorization", `Bearer ${token}`)
        .send(payload)
        .expect(200);

      const second = await request(app!.server)
        .post(`/api/habits/${created.body.id}/log`)
        .set("Authorization", `Bearer ${token}`)
        .send(payload)
        .expect(200);

      expect(second.body.id).toBe(first.body.id);
    });

    it("can update completed to false (undo check-in)", async () => {
      const { token } = await registerAndLogin(app!, "checkin-undo");
      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      await request(app!.server)
        .post(`/api/habits/${created.body.id}/log`)
        .set("Authorization", `Bearer ${token}`)
        .send({ logDate: "2026-03-12", completed: true })
        .expect(200);

      const res = await request(app!.server)
        .post(`/api/habits/${created.body.id}/log`)
        .set("Authorization", `Bearer ${token}`)
        .send({ logDate: "2026-03-12", completed: false })
        .expect(200);

      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });

    it("returns 422 when habit is inactive", async () => {
      const { token } = await registerAndLogin(app!, "checkin-inactive");
      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token}`)
        .send(BASE_HABIT)
        .expect(201);

      await request(app!.server)
        .delete(`/api/habits/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      await request(app!.server)
        .post(`/api/habits/${created.body.id}/log`)
        .set("Authorization", `Bearer ${token}`)
        .send({ logDate: "2026-03-12", completed: true })
        .expect(422);
    });

    it("returns 404 for another user's habit", async () => {
      const { token: token1 } = await registerAndLogin(app!, "checkin-owner");
      const { token: token2 } = await registerAndLogin(app!, "checkin-other");

      const created = await request(app!.server)
        .post("/api/habits")
        .set("Authorization", `Bearer ${token1}`)
        .send(BASE_HABIT)
        .expect(201);

      await request(app!.server)
        .post(`/api/habits/${created.body.id}/log`)
        .set("Authorization", `Bearer ${token2}`)
        .send({ logDate: "2026-03-12", completed: true })
        .expect(404);
    });
  });
});
