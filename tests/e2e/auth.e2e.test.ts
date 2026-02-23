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
  let app: FastifyInstance;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;
    app = await buildTestApp();
  }, 60000); // 60s timeout for Testcontainers to download/start PostgreSQL in CI

  afterAll(async () => {
    await app.close();
    if (testDb) {
      await testDb.teardown();
    }
  });

  it("registers a new user and returns a token", async () => {
    const response = await request(app.server)
      .post("/auth/register")
      .send({ email: "e2e@example.com", password: "password123", name: "E2E User" })
      .expect(201);

    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe("e2e@example.com");
  });

  it("returns 400 when registering a duplicate email", async () => {
    const payload = { email: "dup@example.com", password: "password123", name: "Dup" };
    await request(app.server).post("/auth/register").send(payload);

    const response = await request(app.server).post("/auth/register").send(payload);
    expect(response.status).toBe(400);
  });

  it("logs in and returns a token", async () => {
    await request(app.server)
      .post("/auth/register")
      .send({ email: "login@example.com", password: "password123", name: "Login User" });

    const response = await request(app.server)
      .post("/auth/login")
      .send({ email: "login@example.com", password: "password123" })
      .expect(200);

    expect(response.body.token).toBeDefined();
  });

  it("returns 401 for wrong password", async () => {
    await request(app.server)
      .post("/auth/register")
      .send({ email: "wrongpw@example.com", password: "correct-password", name: "WrongPw User" });

    const response = await request(app.server)
      .post("/auth/login")
      .send({ email: "wrongpw@example.com", password: "wrong-password" })
      .expect(401);

    expect(response.body.error).toBe("Invalid email or password");
  });

  it("finds a user by id and returns undefined for unknown id", async () => {
    const registerRes = await request(app.server)
      .post("/auth/register")
      .send({ email: "findbyid@example.com", password: "password123", name: "FindById User" });

    const userId = registerRes.body.user.id;
    const found = await usersRepository.findById(userId);
    expect(found?.email).toBe("findbyid@example.com");

    const notFound = await usersRepository.findById("00000000-0000-0000-0000-000000000099");
    expect(notFound).toBeUndefined();
  });
});
