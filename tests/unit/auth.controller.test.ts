import { createAuthController } from "@/modules/auth/auth.controller.js";
import { ConflictError, UnauthorizedError } from "@/shared/errors/index.js";
import type { AuthService } from "@/modules/auth/auth.service.js";

const mockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
  ui_lang: "pt-BR",
};

function makeMockService(): jest.Mocked<AuthService> {
  return {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };
}

function makeReply() {
  return {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setCookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
}

function makeRequest(
  body: Record<string, unknown>,
  cookies: Record<string, string> = {},
  jwtSign = jest.fn().mockReturnValue("token")
) {
  return {
    body,
    cookies,
    server: { jwt: { sign: jwtSign } },
  };
}

describe("AuthController.register", () => {
  let mockService: jest.Mocked<AuthService>;
  let controller: ReturnType<typeof createAuthController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createAuthController(mockService);
  });

  it("returns 201 with token and user on success", async () => {
    mockService.register.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: mockUser,
    });
    const request = makeRequest({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });
    const reply = makeReply();

    await controller.register(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({ token: "access-token", user: mockUser });
    expect(reply.setCookie).toHaveBeenCalledWith(
      "refreshToken",
      "refresh-token",
      expect.any(Object)
    );
  });

  it("returns 409 when authService throws ConflictError", async () => {
    mockService.register.mockRejectedValue(
      new ConflictError("User with this email already exists")
    );
    const request = makeRequest({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });
    const reply = makeReply();

    await controller.register(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith({ error: "User with this email already exists" });
  });

  it("returns 500 when a non-Error is thrown", async () => {
    mockService.register.mockRejectedValue("unexpected string rejection");
    const request = makeRequest({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });
    const reply = makeReply();

    await controller.register(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("returns 422 when body fails Zod validation", async () => {
    const request = makeRequest({ email: "not-an-email", password: "x", name: "A" });
    const reply = makeReply();

    await controller.register(request as never, reply as never);

    expect(mockService.register).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Validation failed" })
    );
  });
});

describe("AuthController.login", () => {
  let mockService: jest.Mocked<AuthService>;
  let controller: ReturnType<typeof createAuthController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createAuthController(mockService);
  });

  it("returns 200 with token and user on success", async () => {
    mockService.login.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: mockUser,
    });
    const request = makeRequest({ email: "test@example.com", password: "password123" });
    const reply = makeReply();

    await controller.login(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ token: "access-token", user: mockUser });
    expect(reply.setCookie).toHaveBeenCalledWith(
      "refreshToken",
      "refresh-token",
      expect.any(Object)
    );
  });

  it("returns 401 when authService throws an Error", async () => {
    mockService.login.mockRejectedValue(new UnauthorizedError("Invalid email or password"));
    const request = makeRequest({ email: "test@example.com", password: "wrong" });
    const reply = makeReply();

    await controller.login(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Invalid email or password" });
  });

  it("returns 500 when a non-Error is thrown", async () => {
    mockService.login.mockRejectedValue({ code: "UNKNOWN" });
    const request = makeRequest({ email: "test@example.com", password: "password123" });
    const reply = makeReply();

    await controller.login(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("AuthController.refresh", () => {
  let mockService: jest.Mocked<AuthService>;
  let controller: ReturnType<typeof createAuthController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createAuthController(mockService);
  });

  it("returns 200 with new tokens on success", async () => {
    mockService.refresh.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      user: mockUser,
    });
    const request = makeRequest({}, { refreshToken: "old-refresh-token" });
    const reply = makeReply();

    await controller.refresh(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ token: "new-access", user: mockUser });
    expect(reply.setCookie).toHaveBeenCalledWith("refreshToken", "new-refresh", expect.any(Object));
  });

  it("returns 401 when refresh token not provided", async () => {
    const request = makeRequest({}, {});
    const reply = makeReply();

    await controller.refresh(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Refresh token not provided" });
  });

  it("clears cookie and returns 401 when service throws UnauthorizedError", async () => {
    mockService.refresh.mockRejectedValue(
      new UnauthorizedError("Invalid or expired refresh token")
    );
    const request = makeRequest({}, { refreshToken: "bad-token" });
    const reply = makeReply();

    await controller.refresh(request as never, reply as never);

    expect(reply.clearCookie).toHaveBeenCalledWith("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    expect(reply.code).toHaveBeenCalledWith(401);
  });
});

describe("AuthController.logout", () => {
  let mockService: jest.Mocked<AuthService>;
  let controller: ReturnType<typeof createAuthController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createAuthController(mockService);
  });

  it("returns 204 and clears cookie", async () => {
    mockService.logout.mockResolvedValue();
    const request = makeRequest({}, { refreshToken: "some-token" });
    const reply = makeReply();

    await controller.logout(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(204);
    expect(reply.clearCookie).toHaveBeenCalledWith("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
  });

  it("returns 204 without calling service when no refresh token in cookie", async () => {
    const request = makeRequest({}, {});
    const reply = makeReply();

    await controller.logout(request as never, reply as never);

    expect(mockService.logout).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(204);
    expect(reply.clearCookie).toHaveBeenCalledWith("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
  });

  it("clears cookie and handles error when service throws", async () => {
    mockService.logout.mockRejectedValue(new Error("DB error"));
    const request = makeRequest({}, { refreshToken: "some-token" });
    const reply = makeReply();

    await controller.logout(request as never, reply as never);

    expect(reply.clearCookie).toHaveBeenCalledWith("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    expect(reply.code).toHaveBeenCalledWith(500);
  });
});
