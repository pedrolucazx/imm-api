import { authService } from "@/modules/auth/auth.service.js";
import * as connection from "@/core/database/connection.js";
import { usersRepository } from "@/modules/users/users.repository.js";
import { userProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import { refreshTokensRepository } from "@/modules/auth/refresh-tokens.repository.js";
import { comparePassword } from "@/shared/utils/password.js";
import { ConflictError, UnauthorizedError } from "@/shared/errors/index.js";
import type { RefreshToken } from "@/core/database/schema/refresh-tokens.schema.js";

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
    findById: jest.fn(),
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

jest.mock("@/modules/auth/refresh-tokens.repository.js", () => ({
  refreshTokensRepository: {
    create: jest.fn(),
    findByHash: jest.fn(),
    revoke: jest.fn(),
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
const mockRefreshTokensRepo = refreshTokensRepository as jest.Mocked<
  typeof refreshTokensRepository
>;
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

let mockTx: {
  select: ReturnType<typeof jest.fn>;
  insert: ReturnType<typeof jest.fn>;
};

const mockJwt = jest
  .fn()
  .mockImplementation((_payload: unknown, _options: unknown) => "mocked-token");

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue(mockDb);

    mockTx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
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
  });

  describe("register", () => {
    it("throws if user with email already exists", async () => {
      mockTx.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      await expect(
        authService.register(
          {
            email: "test@example.com",
            password: "password123",
            name: "Test User",
          },
          mockJwt
        )
      ).rejects.toBeInstanceOf(ConflictError);

      expect(mockTx.select).toHaveBeenCalled();
    });

    it("creates user and profile successfully", async () => {
      const newUser = { ...mockUser, email: "new@example.com" };

      mockTx.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = mockTx.insert as jest.Mock;
      mockInsert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest
            .fn()
            .mockResolvedValueOnce([newUser])
            .mockResolvedValueOnce([mockProfile]),
        }),
      });

      mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.register(
        {
          email: "new@example.com",
          password: "password123",
          name: "New User",
        },
        mockJwt
      );

      expect(result.user.email).toBe("new@example.com");
      expect(result.accessToken).toBe("mocked-token");
      expect(result.refreshToken).toBe("mocked-token");
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("login", () => {
    it("throws if user is not found", async () => {
      mockUsersRepo.findByEmail.mockResolvedValue(undefined);

      await expect(
        authService.login({ email: "nobody@example.com", password: "pass" }, mockJwt)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws if password is wrong", async () => {
      mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "test@example.com", password: "wrong" }, mockJwt)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("updates profile and returns auth response when ui_lang is provided", async () => {
      mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockProfilesRepo.update.mockResolvedValue({ ...mockProfile, uiLanguage: "en-US" });
      mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.login(
        {
          email: "test@example.com",
          password: "password123",
          ui_lang: "en-US",
        },
        mockJwt
      );

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
      mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.login(
        {
          email: "test@example.com",
          password: "password123",
        },
        mockJwt
      );

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.id).toBe(mockUser.id);
      expect(mockProfilesRepo.findByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(mockProfilesRepo.update).not.toHaveBeenCalled();
      expect(result.user.ui_lang).toBe("pt-BR");
    });
  });

  describe("refresh", () => {
    it("throws if refresh token is invalid", async () => {
      mockRefreshTokensRepo.findByHash.mockResolvedValue(undefined);

      await expect(authService.refresh("invalid-token", mockJwt)).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });

    it("throws if refresh token is expired", async () => {
      mockRefreshTokensRepo.findByHash.mockResolvedValue({
        id: "1",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date("2020-01-01"),
        revokedAt: null,
        userAgent: null,
      });

      await expect(authService.refresh("expired-token", mockJwt)).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });

    it("returns new tokens on successful refresh", async () => {
      mockRefreshTokensRepo.findByHash.mockResolvedValue({
        id: "1",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        userAgent: null,
      });
      mockUsersRepo.findById.mockResolvedValue(mockUser);
      mockProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      mockRefreshTokensRepo.revoke.mockResolvedValue();
      mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.refresh("valid-token", mockJwt);

      expect(result.user.email).toBe("test@example.com");
      expect(result.accessToken).toBe("mocked-token");
      expect(result.refreshToken).toBe("mocked-token");
      expect(mockRefreshTokensRepo.revoke).toHaveBeenCalled();
      expect(mockRefreshTokensRepo.create).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("revokes refresh token", async () => {
      mockRefreshTokensRepo.revoke.mockResolvedValue();

      await authService.logout("some-token");

      expect(mockRefreshTokensRepo.revoke).toHaveBeenCalled();
    });
  });
});
