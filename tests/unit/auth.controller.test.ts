import { AuthController } from "@/modules/auth/auth.controller.js";
import { authService } from "@/modules/auth/auth.service.js";

jest.mock("@/modules/auth/auth.service.js", () => ({
  authService: {
    register: jest.fn(),
    login: jest.fn(),
  },
}));

const mockService = authService as jest.Mocked<typeof authService>;

function makeReply() {
  const reply = {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

function makeRequest(body: Record<string, unknown>, jwtSign = jest.fn().mockReturnValue("token")) {
  return {
    body,
    server: { jwt: { sign: jwtSign } },
  };
}

const mockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

let controller: AuthController;

beforeEach(() => {
  jest.clearAllMocks();
  controller = new AuthController();
});

describe("AuthController.register", () => {
  it("returns 201 with token and user on success", async () => {
    mockService.register.mockResolvedValue({ token: "", user: mockUser });
    const request = makeRequest({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });
    const reply = makeReply();

    await controller.register(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({ token: "token", user: mockUser });
  });

  it("returns 400 when authService throws an Error", async () => {
    mockService.register.mockRejectedValue(new Error("User with this email already exists"));
    const request = makeRequest({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });
    const reply = makeReply();

    await controller.register(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(400);
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
});

describe("AuthController.login", () => {
  it("returns 200 with token and user on success", async () => {
    mockService.login.mockResolvedValue({ token: "", user: mockUser });
    const request = makeRequest({ email: "test@example.com", password: "password123" });
    const reply = makeReply();

    await controller.login(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ token: "token", user: mockUser });
  });

  it("returns 401 when authService throws an Error", async () => {
    mockService.login.mockRejectedValue(new Error("Invalid email or password"));
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
