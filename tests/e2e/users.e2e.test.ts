import request from "supertest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildTestApp } from "./helpers/app.js";
import { closeDb, getDb } from "@/core/database/connection.js";
import { users } from "@/core/database/schema/users.schema.js";
import { userProfiles } from "@/core/database/schema/user-profiles.schema.js";
import { setupTestDatabase, type TestDatabase } from "../integration/helpers/database.js";

describe("GET /users/me + PUT /users/me", () => {
  let app: FastifyInstance | undefined;
  let testDb: TestDatabase | undefined;
  let accessToken: string;
  let userId: string;

  const uniqueEmail = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;
    app = await buildTestApp();

    const registerRes = await request(app.server)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "Profile User" });

    accessToken = registerRes.body.token;
    userId = registerRes.body.user.id;
  }, 120000);

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      const db = getDb();
      await db.delete(userProfiles);
      await db.delete(users);
      await closeDb();
      if (testDb) await testDb.teardown();
    }
  });

  describe("GET /users/me", () => {
    it("returns 401 when no token provided", async () => {
      const response = await request(app!.server).get("/api/users/me").expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("returns 401 when token is invalid", async () => {
      const response = await request(app!.server)
        .get("/api/users/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("returns 200 with profile when authenticated", async () => {
      const response = await request(app!.server)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
      expect(response.body.email).toBe(uniqueEmail);
      expect(response.body.name).toBe("Profile User");
      expect(response.body.avatarUrl).toBeNull();
      expect(response.body.profile).toMatchObject({
        uiLanguage: expect.any(String),
        bio: null,
        timezone: expect.any(String),
        aiRequestsToday: 0,
      });
    });

    it("returns 200 with default profile values when user has no profile row", async () => {
      // Remove the profile row to simulate a user without a persisted profile
      const db = getDb();
      await db.delete(userProfiles).where(eq(userProfiles.userId, userId));

      const response = await request(app!.server)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
      expect(response.body.profile).toMatchObject({
        uiLanguage: expect.any(String),
        bio: null,
        timezone: expect.any(String),
        aiRequestsToday: 0,
      });
    });
  });

  describe("PUT /users/me", () => {
    it("returns 401 when no token provided", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .send({ name: "New Name" })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("returns 401 when token is invalid", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", "Bearer invalid-token")
        .send({ name: "New Name" })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("updates name and returns updated profile", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Updated Name" })
        .expect(200);

      expect(response.body.name).toBe("Updated Name");
      expect(response.body.id).toBe(userId);
    });

    it("updates uiLanguage and returns updated profile", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ uiLanguage: "en-US" })
        .expect(200);

      expect(response.body.profile.uiLanguage).toBe("en-US");
    });

    it("updates multiple fields at once", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Full Update",
          uiLanguage: "es-ES",
          bio: "Developer and coffee lover",
          timezone: "America/New_York",
        })
        .expect(200);

      expect(response.body.name).toBe("Full Update");
      expect(response.body.profile.uiLanguage).toBe("es-ES");
      expect(response.body.profile.bio).toBe("Developer and coffee lover");
      expect(response.body.profile.timezone).toBe("America/New_York");
    });

    it("returns 400 for invalid uiLanguage", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ uiLanguage: "xx-XX" })
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it("returns 400 for invalid avatarUrl", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ avatarUrl: "not-a-url" })
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it("accepts empty body and returns current profile", async () => {
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      expect(response.body.id).toBe(userId);
    });

    it("clears bio with null", async () => {
      // First set a bio
      await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ bio: "Some bio" })
        .expect(200);

      // Then clear it with null
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ bio: null })
        .expect(200);

      expect(response.body.profile.bio).toBeNull();
    });

    it("clears avatarUrl with null", async () => {
      // First set an avatarUrl
      await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ avatarUrl: "https://example.com/avatar.png" })
        .expect(200);

      // Then clear it with null
      const response = await request(app!.server)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ avatarUrl: null })
        .expect(200);

      expect(response.body.avatarUrl).toBeNull();
    });
  });
});
