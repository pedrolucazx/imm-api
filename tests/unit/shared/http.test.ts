import { z, ZodError } from "zod";
import { handleControllerError } from "@/shared/http/handle-error.js";
import { parseAudioMultipart } from "@/shared/http/parse-audio-multipart.js";
import { UnauthorizedError, TooManyRequestsError } from "@/shared/errors/index.js";

function makeReply() {
  return {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

describe("handleControllerError", () => {
  it("returns statusCode and message for AppError", () => {
    const reply = makeReply();
    const error = new UnauthorizedError("not allowed");

    handleControllerError(error, reply as never);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "not allowed" });
  });

  it("returns 422 with details for ZodError", () => {
    const reply = makeReply();
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse({ email: "not-an-email" });
    const zodError = (parsed as { success: false; error: ZodError }).error;

    handleControllerError(zodError, reply as never);

    expect(reply.code).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith({
      error: "Validation failed",
      details: zodError.issues,
    });
  });

  it("returns 429 for TooManyRequestsError", () => {
    const reply = makeReply();
    const error = new TooManyRequestsError("rate limit exceeded");

    handleControllerError(error, reply as never);

    expect(reply.code).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({ error: "rate limit exceeded" });
  });

  it("returns 500 for unknown errors", () => {
    const reply = makeReply();

    handleControllerError(new Error("something broke"), reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("returns 500 for non-Error throws", () => {
    const reply = makeReply();

    handleControllerError("a string error", reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("parseAudioMultipart", () => {
  const validPart = {
    fieldname: "audio",
    mimetype: "audio/webm",
    toBuffer: jest.fn().mockResolvedValue(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
    fields: { habitId: { type: "field", value: "550e8400-e29b-41d4-a716-446655440000" } },
  };

  it("rejects a file field not named audio", async () => {
    await expect(
      parseAudioMultipart({
        file: jest.fn().mockResolvedValue({ ...validPart, fieldname: "file" }),
      } as never)
    ).rejects.toThrow("Audio field must be named audio");
  });

  it("rejects audio whose bytes do not match its MIME type", async () => {
    await expect(
      parseAudioMultipart({
        file: jest.fn().mockResolvedValue({
          ...validPart,
          toBuffer: jest.fn().mockResolvedValue(Buffer.from("not-webm")),
        }),
      } as never)
    ).rejects.toThrow("Invalid audio file");
  });
});
