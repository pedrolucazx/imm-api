// Setup environment variables before any module is imported by Jest
// These are safe, non-sensitive values for the test environment

process.env.NODE_ENV = "test";
process.env.PORT = "3002";
process.env.API_HOST = "localhost:3002";
process.env.LOG_LEVEL = "error";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long!!";
process.env.CORS_ORIGIN = "http://localhost:3000";
// Placeholder — overridden per test file by testcontainers in integration/e2e tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/test";
