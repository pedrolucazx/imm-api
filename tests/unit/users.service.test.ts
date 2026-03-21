import { createUsersService } from "@/modules/users/users.service.js";
import { NotFoundError, UnauthorizedError } from "@/shared/errors/index.js";
import { comparePassword } from "@/shared/utils/password.js";
import type { UsersRepository } from "@/modules/users/users.repository.js";
import type { UserProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import type { DrizzleDb } from "@/core/database/connection.js";

jest.mock("@/shared/utils/password.js");

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

function makeMockUsersRepo(): jest.Mocked<UsersRepository> {
  return {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    deleteById: jest.fn(),
  };
}

function makeMockUserProfilesRepo(): jest.Mocked<UserProfilesRepository> {
  return {
    create: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };
}

function makeMockDb(transactionResult?: unknown): jest.Mocked<DrizzleDb> {
  return {
    transaction: jest
      .fn()
      .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        transactionResult !== undefined ? transactionResult : fn({})
      ),
  } as unknown as jest.Mocked<DrizzleDb>;
}

describe("UsersService.getProfile", () => {
  let usersRepo: jest.Mocked<UsersRepository>;
  let userProfilesRepo: jest.Mocked<UserProfilesRepository>;
  let db: jest.Mocked<DrizzleDb>;
  let service: ReturnType<typeof createUsersService>;

  beforeEach(() => {
    jest.clearAllMocks();
    usersRepo = makeMockUsersRepo();
    userProfilesRepo = makeMockUserProfilesRepo();
    db = makeMockDb();
    service = createUsersService({ usersRepo, userProfilesRepo, db });
  });

  it("returns profile response when user and profile exist", async () => {
    usersRepo.findById.mockResolvedValue(mockUser);
    userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);

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
    expect(usersRepo.findById).toHaveBeenCalledWith(mockUser.id);
    expect(userProfilesRepo.findByUserId).toHaveBeenCalledWith(mockUser.id);
  });

  it("returns default profile values when user has no profile row", async () => {
    usersRepo.findById.mockResolvedValue(mockUser);
    userProfilesRepo.findByUserId.mockResolvedValue(undefined);

    const result = await service.getProfile(mockUser.id);

    expect(result.id).toBe(mockUser.id);
    expect(result.profile.uiLanguage).toBeDefined();
    expect(result.profile.timezone).toBeDefined();
    expect(result.profile.aiRequestsToday).toBe(0);
  });

  it("throws NotFoundError when user not found", async () => {
    usersRepo.findById.mockResolvedValue(undefined);

    await expect(service.getProfile(mockUser.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(userProfilesRepo.findByUserId).not.toHaveBeenCalled();
  });
});

describe("UsersService.updateProfile", () => {
  let usersRepo: jest.Mocked<UsersRepository>;
  let userProfilesRepo: jest.Mocked<UserProfilesRepository>;
  let db: jest.Mocked<DrizzleDb>;
  let service: ReturnType<typeof createUsersService>;

  const txSentinel = {};

  beforeEach(() => {
    jest.clearAllMocks();
    usersRepo = makeMockUsersRepo();
    userProfilesRepo = makeMockUserProfilesRepo();
  });

  function makeService() {
    db = {
      transaction: jest
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(txSentinel)),
    } as unknown as jest.Mocked<DrizzleDb>;
    return createUsersService({ usersRepo, userProfilesRepo, db });
  }

  it("updates user name via atomic transaction", async () => {
    const updatedUser = { ...mockUser, name: "New Name" };
    usersRepo.update.mockResolvedValue(updatedUser);
    userProfilesRepo.upsert.mockResolvedValue(mockProfile);
    service = makeService();

    const result = await service.updateProfile(mockUser.id, { name: "New Name" });

    expect(result.name).toBe("New Name");
    expect(db.transaction).toHaveBeenCalled();
    expect(usersRepo.update).toHaveBeenCalledWith(
      mockUser.id,
      { name: "New Name", avatarUrl: undefined },
      txSentinel
    );
    expect(userProfilesRepo.findByUserId).toHaveBeenCalledWith(mockUser.id, txSentinel);
  });

  it("fetches existing user directly when no user fields are provided", async () => {
    usersRepo.findById.mockResolvedValue(mockUser);
    const updatedProfile = { ...mockProfile, uiLanguage: "en-US" };
    userProfilesRepo.upsert.mockResolvedValue(updatedProfile);
    service = makeService();

    const result = await service.updateProfile(mockUser.id, { uiLanguage: "en-US" });

    expect(usersRepo.update).not.toHaveBeenCalled();
    expect(usersRepo.findById).toHaveBeenCalledWith(mockUser.id, txSentinel);
    expect(result.profile.uiLanguage).toBe("en-US");
  });

  it("updates all fields at once", async () => {
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
    usersRepo.update.mockResolvedValue(updatedUser);
    userProfilesRepo.upsert.mockResolvedValue(updatedProfile);
    service = makeService();

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

  it("throws NotFoundError when user does not exist", async () => {
    usersRepo.update.mockResolvedValue(undefined);
    usersRepo.findById.mockResolvedValue(undefined);
    service = makeService();

    await expect(service.updateProfile(mockUser.id, { name: "Ghost" })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});

describe("UsersService.deleteAccount", () => {
  let usersRepo: jest.Mocked<UsersRepository>;
  let userProfilesRepo: jest.Mocked<UserProfilesRepository>;
  let db: jest.Mocked<DrizzleDb>;
  let service: ReturnType<typeof createUsersService>;

  const txSentinel = {};

  beforeEach(() => {
    jest.clearAllMocks();
    usersRepo = makeMockUsersRepo();
    userProfilesRepo = makeMockUserProfilesRepo();
    db = {
      transaction: jest
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(txSentinel)),
    } as unknown as jest.Mocked<DrizzleDb>;
    service = createUsersService({ usersRepo, userProfilesRepo, db });
  });

  it("deletes user inside transaction after password validation", async () => {
    usersRepo.findById.mockResolvedValue(mockUser);
    usersRepo.deleteById.mockResolvedValue(undefined);
    (comparePassword as jest.Mock).mockResolvedValue(true);

    await service.deleteAccount(mockUser.id, "any-password");

    expect(comparePassword).toHaveBeenCalledWith("any-password", mockUser.passwordHash);
    expect(usersRepo.deleteById).toHaveBeenCalledWith(mockUser.id, txSentinel);
  });

  it("throws NotFoundError when user does not exist", async () => {
    usersRepo.findById.mockResolvedValue(undefined);

    await expect(service.deleteAccount(mockUser.id, "password")).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(usersRepo.deleteById).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedError when password is invalid", async () => {
    usersRepo.findById.mockResolvedValue(mockUser);
    (comparePassword as jest.Mock).mockResolvedValue(false);

    await expect(service.deleteAccount(mockUser.id, "wrong-password")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    expect(usersRepo.deleteById).not.toHaveBeenCalled();
  });
});
