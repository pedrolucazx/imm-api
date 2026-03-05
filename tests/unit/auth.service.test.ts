import { authService } from "@/modules/auth/auth.service.js";
import * as connection from "@/core/database/connection.js";
import { usersRepository } from "@/modules/users/users.repository.js";
import { userProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import { comparePassword } from "@/shared/utils/password.js";
import { ConflictError, UnauthorizedError } from "@/shared/errors/index.js";

jest.mock("@/shared/utils/password.js", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password"),
  comparePassword: jest.fn(),
}));

jest.mock("@/core/database/connection.js", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/modules/users/users.repository.js", () => ({
  usersRepository: {
    findByEmail: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("@/modules/users/user-profiles.repository.js", () => ({
  userProfilesRepository: {
    create: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  },
}));

const mockDb = {
  transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback({})),
  select: jest.fn(),
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([]),
    }),
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([]),
      }),
    }),
  }),
} as unknown as ReturnType<typeof connection.getDb>;

const mockGetDb = connection.getDb as jest.MockedFunction<typeof connection.getDb>;
const mockUsersRepo = usersRepository as jest.Mocked<typeof usersRepository>;
const mockProfilesRepo = userProfilesRepository as jest.Mocked<typeof userProfilesRepository>;
const mockCompare = comparePassword as jest.MockedFunction<typeof comparePassword>;

const mockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
  passwordHash: "$2b$10$examplehashvalue",
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

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue(mockDb);
  });

  describe("register", () => {
    it("throws if user with email already exists", async () => {
      const mockTx = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockUser]),
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([]),
          }),
        }),
      };
      mockDb.transaction = jest.fn(async (callback) => {
        return callback(mockTx);
      }) as never;

      await expect(
        authService.register({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        })
      ).rejects.toBeInstanceOf(ConflictError);

      expect(mockTx.select).toHaveBeenCalled();
    });

    it("creates user and profile successfully", async () => {
      const newUser = { ...mockUser, email: "new@example.com" };
      const mockTx = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest
              .fn()
              .mockResolvedValueOnce([newUser])
              .mockResolvedValueOnce([mockProfile]),
          }),
        }),
      };
      mockDb.transaction = jest.fn(async (callback) => {
        return callback(mockTx);
      }) as never;

      const result = await authService.register({
        email: "new@example.com",
        password: "password123",
        name: "New User",
      });

      expect(result.user.email).toBe("new@example.com");
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("login", () => {
    it("throws if user is not found", async () => {
      mockUsersRepo.findByEmail.mockResolvedValue(undefined);

      await expect(
        authService.login({ email: "nobody@example.com", password: "pass" })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws if password is wrong", async () => {
      mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "test@example.com", password: "wrong" })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("updates profile and returns auth response when ui_lang is provided", async () => {
      mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockProfilesRepo.update.mockResolvedValue({ ...mockProfile, uiLanguage: "en-US" });

      const result = await authService.login({
        email: "test@example.com",
        password: "password123",
        ui_lang: "en-US",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.id).toBe(mockUser.id);
      expect(mockUsersRepo.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(mockProfilesRepo.update).toHaveBeenCalledWith(mockUser.id, { uiLanguage: "en-US" });
      expect(result.user.ui_lang).toBe("en-US");
    });

    it("returns auth response without updating profile if ui_lang not provided", async () => {
      mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockProfilesRepo.findByUserId.mockResolvedValue(mockProfile);

      const result = await authService.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.id).toBe(mockUser.id);
      expect(mockProfilesRepo.findByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(mockProfilesRepo.update).not.toHaveBeenCalled();
      expect(result.user.ui_lang).toBe("pt-BR");
    });
  });
});
