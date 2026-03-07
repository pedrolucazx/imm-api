import { ZodError } from "zod";
import { handleControllerError } from "@/shared/utils/http.js";
import { UnauthorizedError } from "@/shared/errors/index.js";

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
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "undefined",
        path: ["email"],
        message: "Required",
      } as never,
    ]);

    handleControllerError(zodError, reply as never);

    expect(reply.code).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Validation failed", details: expect.any(Array) })
    );
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
