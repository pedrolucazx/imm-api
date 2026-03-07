import { createProfileController } from "@/modules/profile/profile.controller.js";
import { NotFoundError, UnauthorizedError } from "@/shared/errors/index.js";
import type { ProfileService } from "@/modules/profile/profile.service.js";

const mockProfileResponse = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
  profile: {
    uiLanguage: "pt-BR",
    bio: null,
    timezone: "America/Sao_Paulo",
    aiRequestsToday: 0,
  },
};

function makeMockService(): jest.Mocked<ProfileService> {
  return {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
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

describe("ProfileController.get", () => {
  let mockService: jest.Mocked<ProfileService>;
  let controller: ReturnType<typeof createProfileController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createProfileController(mockService);
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

describe("ProfileController.update", () => {
  let mockService: jest.Mocked<ProfileService>;
  let controller: ReturnType<typeof createProfileController>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = createProfileController(mockService);
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
