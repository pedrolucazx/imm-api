import { z, ZodError } from "zod";
import { handleControllerError } from "@/shared/utils/http.js";
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
