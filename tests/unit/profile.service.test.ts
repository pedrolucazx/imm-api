import { createProfileService } from "@/modules/profile/profile.service.js";
import { NotFoundError } from "@/shared/errors/index.js";
import type { ProfileRepository } from "@/modules/profile/profile.repository.js";

const mockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
  passwordHash: "hash",
  avatarUrl: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const mockProfile = {
  id: "00000000-0000-0000-0000-000000000002",
  userId: mockUser.id,
  uiLanguage: "pt-BR",
  bio: null,
  timezone: "America/Sao_Paulo",
  aiRequestsToday: 0,
  lastAiRequest: null,
};

function makeMockRepo(): jest.Mocked<ProfileRepository> {
  return {
    findByUserId: jest.fn(),
    updateUser: jest.fn(),
    upsertProfile: jest.fn(),
    updateProfileAtomic: jest.fn(),
  };
}

describe("ProfileService.getProfile", () => {
  let mockRepo: jest.Mocked<ProfileRepository>;
  let service: ReturnType<typeof createProfileService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = makeMockRepo();
    service = createProfileService({ profileRepo: mockRepo });
  });

  it("returns profile response when user and profile exist", async () => {
    mockRepo.findByUserId.mockResolvedValue({ user: mockUser, profile: mockProfile });

    const result = await service.getProfile(mockUser.id);

    expect(result).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      avatarUrl: null,
      profile: {
        uiLanguage: "pt-BR",
        bio: null,
        timezone: "America/Sao_Paulo",
        aiRequestsToday: 0,
      },
    });
    expect(mockRepo.findByUserId).toHaveBeenCalledWith(mockUser.id);
  });

  it("throws NotFoundError when user/profile not found", async () => {
    mockRepo.findByUserId.mockResolvedValue(undefined);

    await expect(service.getProfile(mockUser.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ProfileService.updateProfile", () => {
  let mockRepo: jest.Mocked<ProfileRepository>;
  let service: ReturnType<typeof createProfileService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = makeMockRepo();
    service = createProfileService({ profileRepo: mockRepo });
  });

  it("updates user name and returns updated profile via atomic transaction", async () => {
    const updatedUser = { ...mockUser, name: "New Name" };
    mockRepo.updateProfileAtomic.mockResolvedValue({ user: updatedUser, profile: mockProfile });

    const result = await service.updateProfile(mockUser.id, { name: "New Name" });

    expect(result.name).toBe("New Name");
    expect(mockRepo.updateProfileAtomic).toHaveBeenCalledWith(
      mockUser.id,
      { name: "New Name", avatarUrl: undefined },
      { uiLanguage: undefined, bio: undefined, timezone: undefined }
    );
  });

  it("updates uiLanguage and returns updated profile via atomic transaction", async () => {
    const updatedProfile = { ...mockProfile, uiLanguage: "en-US" };
    mockRepo.updateProfileAtomic.mockResolvedValue({ user: mockUser, profile: updatedProfile });

    const result = await service.updateProfile(mockUser.id, { uiLanguage: "en-US" });

    expect(result.profile.uiLanguage).toBe("en-US");
    expect(mockRepo.updateProfileAtomic).toHaveBeenCalledWith(
      mockUser.id,
      { name: undefined, avatarUrl: undefined },
      { uiLanguage: "en-US", bio: undefined, timezone: undefined }
    );
  });

  it("updates all fields at once via atomic transaction", async () => {
    const updatedUser = {
      ...mockUser,
      name: "Full Update",
      avatarUrl: "https://example.com/a.png",
    };
    const updatedProfile = {
      ...mockProfile,
      uiLanguage: "es-ES",
      bio: "My bio",
      timezone: "America/New_York",
    };
    mockRepo.updateProfileAtomic.mockResolvedValue({ user: updatedUser, profile: updatedProfile });

    const result = await service.updateProfile(mockUser.id, {
      name: "Full Update",
      avatarUrl: "https://example.com/a.png",
      uiLanguage: "es-ES",
      bio: "My bio",
      timezone: "America/New_York",
    });

    expect(result.name).toBe("Full Update");
    expect(result.avatarUrl).toBe("https://example.com/a.png");
    expect(result.profile.uiLanguage).toBe("es-ES");
    expect(result.profile.bio).toBe("My bio");
    expect(result.profile.timezone).toBe("America/New_York");
  });

  it("throws NotFoundError when updateProfileAtomic resolves with no user", async () => {
    mockRepo.updateProfileAtomic.mockResolvedValue({
      user: undefined as never,
      profile: mockProfile,
    });

    await expect(service.updateProfile(mockUser.id, { name: "Ghost" })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
