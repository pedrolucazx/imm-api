import request from "supertest";
import { buildTestApp } from "./helpers/app.js";
import type { FastifyInstance } from "fastify";
import { setupTestDatabase, type TestDatabase } from "../integration/helpers/database.js";

/**
 * E2E tests run the full Fastify application and test it via HTTP
 * requests (Supertest). Auth-related tests use Testcontainers to
 * start a real PostgreSQL instance and set DATABASE_URL before
 * building the app.
 *
 * Test scope: routes → controllers → services → repositories → DB
 */

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
    // Spin up a real Postgres container for this E2E suite
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;

    // Reset module registry so connection.ts picks up the new DATABASE_URL
    jest.resetModules();

    // Re-import buildTestApp after module reset
    const { buildTestApp: build } = await import("./helpers/app.js");
    app = await build();
  });

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
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
});
