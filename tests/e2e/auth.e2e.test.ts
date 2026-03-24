import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/app.js";
import { createUsersRepository } from "@/modules/users/users.repository.js";
import { closeDb, getDb } from "@/core/database/connection.js";
import { refreshTokens } from "@/core/database/schema/refresh-tokens.schema.js";
import { setupTestDatabase, type TestDatabase } from "../integration/helpers/database.js";
import { verifyEmailInDb } from "./helpers/db.js";

describe("POST /auth/register + /auth/login", () => {
  let app: FastifyInstance | undefined;
  let testDb: TestDatabase | undefined;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;
    app = await buildTestApp();
  }, 120000);

  beforeEach(async () => {
    const db = getDb();
    await db.delete(refreshTokens);
  });

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      await closeDb();
      if (testDb) await testDb.teardown();
    }
  });

  it("registers a new user and returns a verification message", async () => {
    const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;
    const response = await request(app!.server)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "E2E User" })
      .expect(201);

    expect(response.body.message).toBeDefined();
  });

  it("returns 409 when registering a duplicate email", async () => {
    const uniqueEmail = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;
    const payload = { email: uniqueEmail, password: "password123", name: "Dup" };
    const firstResponse = await request(app!.server).post("/api/auth/register").send(payload);
    expect(firstResponse.status).toBe(201);

    const response = await request(app!.server).post("/api/auth/register").send(payload);
    expect(response.status).toBe(409);
  });

  it("returns 403 when email is not verified", async () => {
    const uniqueEmail = `unverified-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;
    await request(app!.server)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "Unverified User" })
      .expect(201);

    const response = await request(app!.server)
      .post("/api/auth/login")
      .send({ email: uniqueEmail, password: "password123" })
      .expect(403);

    expect(response.body.error).toBeDefined();
  });

  it("logs in and returns a token", async () => {
    const uniqueEmail = `login-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;
    await request(app!.server)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "Login User" });

    await verifyEmailInDb(uniqueEmail);

    const response = await request(app!.server)
      .post("/api/auth/login")
      .send({ email: uniqueEmail, password: "password123" })
      .expect(200);

    expect(response.body.token).toBeDefined();
  });

  it("returns 401 for wrong password", async () => {
    const uniqueEmail = `wrongpw-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;
    await request(app!.server)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "correct-password", name: "WrongPw User" });

    await verifyEmailInDb(uniqueEmail);

    const response = await request(app!.server)
      .post("/api/auth/login")
      .send({ email: uniqueEmail, password: "wrong-password" })
      .expect(401);

    expect(response.body.error).toBe("Invalid email or password");
  });

  it("finds a user by id and returns undefined for unknown id", async () => {
    const uniqueEmail = `findbyid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@example.com`;
    await request(app!.server)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "FindById User" });

    const usersRepo = createUsersRepository(getDb());
    const found = await usersRepo.findByEmail(uniqueEmail);
    expect(found).toBeDefined();

    const foundById = await usersRepo.findById(found!.id);
    expect(foundById?.email).toBe(uniqueEmail);

    const notFound = await usersRepo.findById("00000000-0000-0000-0000-000000000099");
    expect(notFound).toBeUndefined();
  });
});
