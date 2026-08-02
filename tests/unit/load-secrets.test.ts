import { loadSecretsFromSsm } from "@/core/config/load-secrets.js";

const mockSsmSend = jest.fn();

jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn().mockImplementation(() => ({ send: mockSsmSend })),
  GetParametersCommand: jest.fn((input) => input),
}));

describe("loadSecretsFromSsm", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockSsmSend.mockReset();
    delete process.env.DATABASE_URL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does nothing outside production", async () => {
    process.env.NODE_ENV = "test";

    await loadSecretsFromSsm();

    expect(mockSsmSend).not.toHaveBeenCalled();
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it("populates process.env from the SSM parameters in production", async () => {
    process.env.NODE_ENV = "production";
    mockSsmSend.mockResolvedValue({
      Parameters: [
        { Name: "/imm/production/DATABASE_URL", Value: "postgresql://from-ssm" },
        { Name: "/imm/production/GEMINI_API_KEY", Value: "gemini-key-from-ssm" },
        { Name: "/imm/production/JWT_SECRET", Value: "jwt-secret-from-ssm" },
      ],
    });

    await loadSecretsFromSsm();

    expect(mockSsmSend).toHaveBeenCalledWith({
      Names: [
        "/imm/production/DATABASE_URL",
        "/imm/production/GEMINI_API_KEY",
        "/imm/production/JWT_SECRET",
      ],
      WithDecryption: true,
    });
    expect(process.env.DATABASE_URL).toBe("postgresql://from-ssm");
    expect(process.env.GEMINI_API_KEY).toBe("gemini-key-from-ssm");
    expect(process.env.JWT_SECRET).toBe("jwt-secret-from-ssm");
  });

  it("falls back to whatever is already in process.env when SSM fails", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://from-dotenv";
    mockSsmSend.mockRejectedValue(new Error("AccessDenied"));

    await expect(loadSecretsFromSsm()).resolves.toBeUndefined();

    expect(process.env.DATABASE_URL).toBe("postgresql://from-dotenv");
  });
});
