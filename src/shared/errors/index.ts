export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, "BAD_REQUEST", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(422, "UNPROCESSABLE", message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string) {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(503, "SERVICE_UNAVAILABLE", message);
  }
}
