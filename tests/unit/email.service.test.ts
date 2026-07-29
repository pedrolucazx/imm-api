const mockResendSend = jest.fn().mockResolvedValue({ error: null });
const mockSesSend = jest.fn().mockResolvedValue({});
const mockEnv: { EMAIL_PROVIDER: "resend" | "ses" } = { EMAIL_PROVIDER: "ses" };

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

jest.mock("@aws-sdk/client-ses", () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock("../../src/core/config/env.js", () => ({
  get env() {
    return mockEnv;
  },
}));

import { sendVerificationEmail } from "../../src/modules/auth/email.service.js";

describe("email.service — provider switch", () => {
  beforeEach(() => {
    mockResendSend.mockClear();
    mockSesSend.mockClear();
  });

  it("sends via Resend when EMAIL_PROVIDER=resend", async () => {
    mockEnv.EMAIL_PROVIDER = "resend";

    await sendVerificationEmail({
      to: "user@example.com",
      verificationLink: "https://insidemymind.tech/verify?token=abc",
      name: "Pedro",
    });

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockSesSend).not.toHaveBeenCalled();
  });

  it("sends via SES when EMAIL_PROVIDER=ses", async () => {
    mockEnv.EMAIL_PROVIDER = "ses";

    await sendVerificationEmail({
      to: "user@example.com",
      verificationLink: "https://insidemymind.tech/verify?token=abc",
      name: "Pedro",
    });

    expect(mockSesSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("throws when SES send fails", async () => {
    mockEnv.EMAIL_PROVIDER = "ses";
    mockSesSend.mockRejectedValueOnce(new Error("SES down"));

    await expect(
      sendVerificationEmail({
        to: "user@example.com",
        verificationLink: "https://insidemymind.tech/verify?token=abc",
        name: "Pedro",
      })
    ).rejects.toThrow("Failed to send email");
  });
});
