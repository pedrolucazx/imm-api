// Setup environment variables before any module is imported by Jest
// These are safe, non-sensitive values for the test environment

process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT || "3333";
process.env.API_HOST = process.env.API_HOST || "localhost:3333";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "error";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-that-is-at-least-32-characters-long!!";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
// DATABASE_URL will be set by CI environment or use local fallback
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/inside_my_mind_dev";
}
