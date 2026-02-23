import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/app.js";
import { usersRepository } from "@/modules/users/users.repository.js";
import { setupTestDatabase, type TestDatabase } from "../integration/helpers/database.js";

describe("GET /", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the welcome message", async () => {
    const response = await request(app.server).get("/").expect(200);

    expect(response.body).toMatchObject({
      message: "Welcome to Inside My Mind API",
      version: "1.0.0",
    });
  });
});

describe("POST /auth/register + /auth/login", () => {
  let app: FastifyInstance | undefined;
  let testDb: TestDatabase | undefined;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;
    app = await buildTestApp();
  }, 120000);

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      if (testDb) await testDb.teardown();
    }
  });

  it("registers a new user and returns a token", async () => {
    const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    const response = await request(app!.server)
      .post("/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "E2E User" })
      .expect(201);

    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe(uniqueEmail);
  });

  it("returns 400 when registering a duplicate email", async () => {
    const uniqueEmail = `dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    const payload = { email: uniqueEmail, password: "password123", name: "Dup" };
    await request(app!.server).post("/auth/register").send(payload);

    const response = await request(app!.server).post("/auth/register").send(payload);
    expect(response.status).toBe(400);
  });

  it("logs in and returns a token", async () => {
    const uniqueEmail = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    await request(app!.server)
      .post("/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "Login User" });

    const response = await request(app!.server)
      .post("/auth/login")
      .send({ email: uniqueEmail, password: "password123" })
      .expect(200);

    expect(response.body.token).toBeDefined();
  });

  it("returns 401 for wrong password", async () => {
    const uniqueEmail = `wrongpw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    await request(app!.server)
      .post("/auth/register")
      .send({ email: uniqueEmail, password: "correct-password", name: "WrongPw User" });

    const response = await request(app!.server)
      .post("/auth/login")
      .send({ email: uniqueEmail, password: "wrong-password" })
      .expect(401);

    expect(response.body.error).toBe("Invalid email or password");
  });

  it("finds a user by id and returns undefined for unknown id", async () => {
    const uniqueEmail = `findbyid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    const registerRes = await request(app!.server)
      .post("/auth/register")
      .send({ email: uniqueEmail, password: "password123", name: "FindById User" });

    const userId = registerRes.body.user.id;
    const found = await usersRepository.findById(userId);
    expect(found?.email).toBe(uniqueEmail);

    const notFound = await usersRepository.findById("00000000-0000-0000-0000-000000000099");
    expect(notFound).toBeUndefined();
  });
});
