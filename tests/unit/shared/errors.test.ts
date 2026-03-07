import {
  AppError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from "@/shared/errors/index.js";

describe("AppError", () => {
  it("sets statusCode, code, message and name", () => {
    const err = new AppError(400, "BAD_REQUEST", "bad request");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("bad request");
    expect(err.name).toBe("AppError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("ConflictError", () => {
  it("has statusCode 409 and code CONFLICT", () => {
    const err = new ConflictError("already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("already exists");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401 and code UNAUTHORIZED", () => {
    const err = new UnauthorizedError("not allowed");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("not allowed");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("ForbiddenError", () => {
  it("has statusCode 403 and code FORBIDDEN", () => {
    const err = new ForbiddenError("forbidden");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("forbidden");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("NotFoundError", () => {
  it("has statusCode 404 and code NOT_FOUND", () => {
    const err = new NotFoundError("not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("not found");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("UnprocessableError", () => {
  it("has statusCode 422 and code UNPROCESSABLE", () => {
    const err = new UnprocessableError("unprocessable");
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("UNPROCESSABLE");
    expect(err.message).toBe("unprocessable");
    expect(err).toBeInstanceOf(AppError);
  });
});
