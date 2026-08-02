import { envSchema } from "../../src/core/config/env.js";

const baseEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters-long!!",
  SUPABASE_URL: "https://fake.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-key",
  GEMINI_API_KEY: "fake-gemini-api-key",
};

describe("envSchema — EMAIL_PROVIDER conditional validation", () => {
  it("accepts EMAIL_PROVIDER=ses without RESEND_API_KEY", () => {
    const result = envSchema.safeParse({ ...baseEnv, EMAIL_PROVIDER: "ses" });

    expect(result.success).toBe(true);
  });

  it("rejects EMAIL_PROVIDER=resend without RESEND_API_KEY", () => {
    const result = envSchema.safeParse({ ...baseEnv, EMAIL_PROVIDER: "resend" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("RESEND_API_KEY"))).toBe(true);
    }
  });

  it("accepts EMAIL_PROVIDER=resend with RESEND_API_KEY", () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
    });

    expect(result.success).toBe(true);
  });
});

describe("envSchema — Supabase is optional", () => {
  it("boots without SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY", () => {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ...envWithoutSupabase } = baseEnv;
    void SUPABASE_URL;
    void SUPABASE_SERVICE_ROLE_KEY;

    const result = envSchema.safeParse(envWithoutSupabase);

    expect(result.success).toBe(true);
  });
});
