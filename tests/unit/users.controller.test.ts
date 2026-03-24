import { createUsersController } from "@/modules/users/users.controller.js";
import { NotFoundError, UnauthorizedError } from "@/shared/errors/index.js";
import type { UsersService } from "@/modules/users/users.service.js";

const mockProfileResponse = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
  emailVerifiedAt: null,
  profile: {
    uiLanguage: "pt-BR",
    bio: null,
    timezone: "America/Sao_Paulo",
    aiRequestsToday: 0,
  },
};

function makeMockService(): jest.Mocked<UsersService> {
  return {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
  };
}

function makeReply() {
  return {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

function makeRequest(
  body: Record<string, unknown> = {},
  user = { id: "00000000-0000-0000-0000-000000000001", email: "test@example.com" }
) {
  return { body, user };
}

describe("UsersController.get", () => {
  let mockService: jest.Mocked<UsersService>;
  let controller: ReturnType<typeof createUsersController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createUsersController(mockService);
  });

  it("returns 200 with profile on success", async () => {
    mockService.getProfile.mockResolvedValue(mockProfileResponse);
    const request = makeRequest();
    const reply = makeReply();

    await controller.get(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(mockProfileResponse);
    expect(mockService.getProfile).toHaveBeenCalledWith(request.user.id);
  });

  it("returns 404 when profile not found", async () => {
    mockService.getProfile.mockRejectedValue(new NotFoundError("Profile not found"));
    const request = makeRequest();
    const reply = makeReply();

    await controller.get(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: "Profile not found" });
  });

  it("returns 500 on unexpected error", async () => {
    mockService.getProfile.mockRejectedValue(new Error("DB connection lost"));
    const request = makeRequest();
    const reply = makeReply();

    await controller.get(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("UsersController.update", () => {
  let mockService: jest.Mocked<UsersService>;
  let controller: ReturnType<typeof createUsersController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createUsersController(mockService);
  });

  it("returns 200 with updated profile on success", async () => {
    const updated = { ...mockProfileResponse, name: "New Name" };
    mockService.updateProfile.mockResolvedValue(updated);
    const request = makeRequest({ name: "New Name" });
    const reply = makeReply();

    await controller.update(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(updated);
    expect(mockService.updateProfile).toHaveBeenCalledWith(
      request.user.id,
      expect.objectContaining({ name: "New Name" })
    );
  });

  it("returns 422 when body fails Zod validation", async () => {
    const request = makeRequest({ uiLanguage: "invalid-lang" });
    const reply = makeReply();

    await controller.update(request as never, reply as never);

    expect(mockService.updateProfile).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Validation failed" })
    );
  });

  it("returns 422 when avatarUrl is not a valid URL", async () => {
    const request = makeRequest({ avatarUrl: "not-a-url" });
    const reply = makeReply();

    await controller.update(request as never, reply as never);

    expect(mockService.updateProfile).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(422);
  });

  it("returns 404 when service throws NotFoundError", async () => {
    mockService.updateProfile.mockRejectedValue(new NotFoundError("Profile not found"));
    const request = makeRequest({ name: "New Name" });
    const reply = makeReply();

    await controller.update(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: "Profile not found" });
  });

  it("returns 500 on unexpected error", async () => {
    mockService.updateProfile.mockRejectedValue({ code: "UNKNOWN" });
    const request = makeRequest({ name: "New Name" });
    const reply = makeReply();

    await controller.update(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("allows partial update with only uiLanguage", async () => {
    const updated = {
      ...mockProfileResponse,
      profile: { ...mockProfileResponse.profile, uiLanguage: "en-US" },
    };
    mockService.updateProfile.mockResolvedValue(updated);
    const request = makeRequest({ uiLanguage: "en-US" });
    const reply = makeReply();

    await controller.update(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(updated);
  });

  it("allows update with UnauthorizedError returning 401", async () => {
    mockService.updateProfile.mockRejectedValue(new UnauthorizedError("Unauthorized"));
    const request = makeRequest({ name: "New" });
    const reply = makeReply();

    await controller.update(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(401);
  });
});

describe("UsersController.delete", () => {
  let mockService: jest.Mocked<UsersService>;
  let controller: ReturnType<typeof createUsersController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createUsersController(mockService);
  });

  it("returns 204 on successful account deletion", async () => {
    mockService.deleteAccount.mockResolvedValue(undefined);
    const request = makeRequest({ password: "valid-password" });
    const reply = makeReply();

    await controller.delete(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(204);
    expect(reply.send).toHaveBeenCalled();
    expect(mockService.deleteAccount).toHaveBeenCalledWith(request.user.id, "valid-password");
  });

  it("returns 400 when password is missing", async () => {
    const request = makeRequest({});
    const reply = makeReply();

    await controller.delete(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Password is required" });
    expect(mockService.deleteAccount).not.toHaveBeenCalled();
  });

  it("returns 400 when body is null", async () => {
    const request = makeRequest(null as unknown as Record<string, unknown>);
    const reply = makeReply();

    await controller.delete(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Password is required" });
    expect(mockService.deleteAccount).not.toHaveBeenCalled();
  });

  it("returns 401 when password is invalid", async () => {
    mockService.deleteAccount.mockRejectedValue(new UnauthorizedError("Invalid password"));
    const request = makeRequest({ password: "wrong-password" });
    const reply = makeReply();

    await controller.delete(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Invalid password" });
  });

  it("returns 404 when user not found", async () => {
    mockService.deleteAccount.mockRejectedValue(new NotFoundError("User not found"));
    const request = makeRequest({ password: "valid-password" });
    const reply = makeReply();

    await controller.delete(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: "User not found" });
  });

  it("returns 500 on unexpected error", async () => {
    mockService.deleteAccount.mockRejectedValue(new Error("Database connection lost"));
    const request = makeRequest({ password: "valid-password" });
    const reply = makeReply();

    await controller.delete(request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
