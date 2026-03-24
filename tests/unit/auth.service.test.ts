import { createAuthService } from "@/modules/auth/auth.service.js";
import { comparePassword } from "@/shared/utils/password.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "@/shared/errors/index.js";
import type { RefreshToken } from "@/core/database/schema/refresh-tokens.schema.js";
import type { UsersRepository } from "@/modules/users/users.repository.js";
import type { UserProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import type { RefreshTokensRepository } from "@/modules/auth/refresh-tokens.repository.js";
import type { DrizzleDb } from "@/core/database/connection.js";

jest.mock("@/modules/auth/email.service.js", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/shared/utils/password.js", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password"),
  comparePassword: jest.fn(),
}));

const mockCompare = comparePassword as jest.MockedFunction<typeof comparePassword>;

const mockUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
  passwordHash: "$2b$10$examplehashvalue",
  avatarUrl: null,
  emailVerifiedAt: new Date("2025-01-01"),
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

let tokenCounter = 0;
const mockJwt = jest.fn().mockImplementation((payload: { type?: string }) => {
  tokenCounter++;
  return payload.type === "refresh"
    ? `refresh-token-${tokenCounter}`
    : `access-token-${tokenCounter}`;
});

function makeMocks() {
  let mockTx: {
    select: jest.Mock;
    insert: jest.Mock;
  };

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

  const mockDb = {
    transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockTx)),
  } as unknown as DrizzleDb;

  const mockUsersRepo: jest.Mocked<UsersRepository> = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    markEmailVerified: jest.fn(),
    updatePasswordHash: jest.fn(),
    deleteById: jest.fn(),
  };

  const mockProfilesRepo: jest.Mocked<UserProfilesRepository> = {
    create: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };

  const mockRefreshTokensRepo: jest.Mocked<RefreshTokensRepository> = {
    create: jest.fn(),
    findByHash: jest.fn(),
    consumeActiveByHash: jest.fn(),
    revoke: jest.fn(),
    deleteExpired: jest.fn(),
  };

  const mockEmailVerificationTokensRepo = {
    create: jest.fn().mockResolvedValue({
      id: "token-id",
      userId: mockUser.id,
      tokenHash: "hash",
      expiresAt: new Date(),
      usedAt: null,
    }),
    findByHash: jest.fn(),
    consumeByHash: jest.fn(),
    markAsUsed: jest.fn(),
    invalidateUserTokens: jest.fn(),
    deleteExpired: jest.fn(),
  };

  return {
    mockDb,
    mockTx,
    mockUsersRepo,
    mockProfilesRepo,
    mockRefreshTokensRepo,
    mockEmailVerificationTokensRepo,
  };
}

describe("AuthService", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let authService: ReturnType<typeof createAuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenCounter = 0;
    mocks = makeMocks();
    authService = createAuthService({
      db: mocks.mockDb,
      usersRepo: mocks.mockUsersRepo,
      profilesRepo: mocks.mockProfilesRepo,
      refreshTokensRepo: mocks.mockRefreshTokensRepo,
      emailVerificationTokensRepo: mocks.mockEmailVerificationTokensRepo,
    });
  });

  describe("register", () => {
    it("throws if user with email already exists", async () => {
      mocks.mockTx.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      await expect(
        authService.register({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        })
      ).rejects.toBeInstanceOf(ConflictError);

      expect(mocks.mockTx.select).toHaveBeenCalled();
    });

    it("throws ConflictError on duplicate key DB error (code 23505)", async () => {
      mocks.mockTx.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const dbError = Object.assign(new Error("duplicate key"), { code: "23505" });
      mocks.mockTx.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(dbError),
        }),
      });

      await expect(
        authService.register({ email: "dup@example.com", password: "password123", name: "Dup" })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError on duplicate key DB error (message includes 'duplicate key')", async () => {
      mocks.mockTx.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const dbError = new Error("duplicate key value violates unique constraint");
      mocks.mockTx.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(dbError),
        }),
      });

      await expect(
        authService.register({ email: "dup2@example.com", password: "password123", name: "Dup2" })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("re-throws unexpected DB error", async () => {
      mocks.mockTx.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const unexpectedError = new Error("connection lost");
      mocks.mockTx.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(unexpectedError),
        }),
      });

      await expect(
        authService.register({ email: "fail@example.com", password: "password123", name: "Fail" })
      ).rejects.toBe(unexpectedError);
    });

    it("creates user and profile successfully", async () => {
      const newUser = { ...mockUser, email: "new@example.com" };

      mocks.mockTx.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = mocks.mockTx.insert as jest.Mock;
      mockInsert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest
            .fn()
            .mockResolvedValueOnce([newUser])
            .mockResolvedValueOnce([mockProfile]),
        }),
      });

      mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.register({
        email: "new@example.com",
        password: "password123",
        name: "New User",
      });

      expect(result.message).toBe("Verification email sent");
      expect(mocks.mockEmailVerificationTokensRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: newUser.id }),
        expect.anything()
      );
      expect(mocks.mockDb.transaction).toHaveBeenCalled();
      expect(mocks.mockTx.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("login", () => {
    it("throws if user is not found", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue(undefined);

      await expect(
        authService.login({ email: "nobody@example.com", password: "pass" }, mockJwt)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws if password is wrong", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "test@example.com", password: "wrong" }, mockJwt)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws ForbiddenError if email is not verified", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue({ ...mockUser, emailVerifiedAt: null });
      mockCompare.mockResolvedValue(true);

      await expect(
        authService.login({ email: "test@example.com", password: "password123" }, mockJwt)
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("updates profile and returns auth response when ui_lang is provided", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mocks.mockProfilesRepo.update.mockResolvedValue({ ...mockProfile, uiLanguage: "en-US" });
      mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

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
      expect(mocks.mockUsersRepo.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(mocks.mockProfilesRepo.update).toHaveBeenCalledWith(mockUser.id, {
        uiLanguage: "en-US",
      });
      expect(result.user.ui_lang).toBe("en-US");
      expect(result.accessToken).toMatch(/^access-token-/);
      expect(result.refreshToken).toMatch(/^refresh-token-/);
      expect(result.accessToken).not.toBe(result.refreshToken);
      expect(mocks.mockRefreshTokensRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockUser.id })
      );
    });

    it("creates profile when update returns null and ui_lang is provided", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mocks.mockProfilesRepo.update.mockResolvedValue(undefined);
      mocks.mockProfilesRepo.create.mockResolvedValue({ ...mockProfile, uiLanguage: "en-US" });
      mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.login(
        { email: "test@example.com", password: "password123", ui_lang: "en-US" },
        mockJwt
      );

      expect(mocks.mockProfilesRepo.update).toHaveBeenCalledWith(mockUser.id, {
        uiLanguage: "en-US",
      });
      expect(mocks.mockProfilesRepo.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        uiLanguage: "en-US",
      });
      expect(result.user.ui_lang).toBe("en-US");
    });

    it("creates profile when findByUserId returns null and no ui_lang provided", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mocks.mockProfilesRepo.findByUserId.mockResolvedValue(undefined);
      mocks.mockProfilesRepo.create.mockResolvedValue({ ...mockProfile, uiLanguage: "pt-BR" });
      mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.login(
        { email: "test@example.com", password: "password123" },
        mockJwt
      );

      expect(mocks.mockProfilesRepo.findByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(mocks.mockProfilesRepo.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        uiLanguage: "pt-BR",
      });
      expect(result.user.ui_lang).toBe("pt-BR");
    });

    it("returns auth response without updating profile if ui_lang not provided", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mocks.mockProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.login(
        {
          email: "test@example.com",
          password: "password123",
        },
        mockJwt
      );

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.id).toBe(mockUser.id);
      expect(mocks.mockProfilesRepo.findByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(mocks.mockProfilesRepo.update).not.toHaveBeenCalled();
      expect(result.user.ui_lang).toBe("pt-BR");
      expect(result.accessToken).toMatch(/^access-token-/);
      expect(result.refreshToken).toMatch(/^refresh-token-/);
      expect(result.accessToken).not.toBe(result.refreshToken);
      expect(mocks.mockRefreshTokensRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockUser.id })
      );
    });
  });

  describe("refresh", () => {
    it("throws if refresh token is invalid", async () => {
      mocks.mockRefreshTokensRepo.consumeActiveByHash.mockResolvedValue(undefined);

      await expect(authService.refresh("invalid-token", mockJwt)).rejects.toBeInstanceOf(
        UnauthorizedError
      );
      expect(mockJwt).not.toHaveBeenCalled();
      expect(mocks.mockRefreshTokensRepo.create).not.toHaveBeenCalled();
    });

    it("throws if refresh token is expired", async () => {
      mocks.mockRefreshTokensRepo.consumeActiveByHash.mockResolvedValue({
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
      expect(mockJwt).not.toHaveBeenCalled();
      expect(mocks.mockRefreshTokensRepo.create).not.toHaveBeenCalled();
    });

    it("throws if user not found after token validation", async () => {
      mocks.mockRefreshTokensRepo.consumeActiveByHash.mockResolvedValue({
        id: "1",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        userAgent: null,
      });
      mocks.mockUsersRepo.findById.mockResolvedValue(undefined);

      await expect(authService.refresh("valid-token", mockJwt)).rejects.toBeInstanceOf(
        UnauthorizedError
      );
      expect(mockJwt).not.toHaveBeenCalled();
      expect(mocks.mockRefreshTokensRepo.create).not.toHaveBeenCalled();
    });

    it("returns new tokens on successful refresh", async () => {
      mocks.mockRefreshTokensRepo.consumeActiveByHash.mockResolvedValue({
        id: "1",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        userAgent: null,
      });
      mocks.mockUsersRepo.findById.mockResolvedValue(mockUser);
      mocks.mockProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.refresh("valid-token", mockJwt);

      expect(result.user.email).toBe("test@example.com");
      expect(result.accessToken).toMatch(/^access-token-/);
      expect(result.refreshToken).toMatch(/^refresh-token-/);
      expect(result.accessToken).not.toBe(result.refreshToken);
      expect(mocks.mockRefreshTokensRepo.consumeActiveByHash).toHaveBeenCalled();
      expect(mocks.mockRefreshTokensRepo.create).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("revokes refresh token", async () => {
      mocks.mockRefreshTokensRepo.revoke.mockResolvedValue();

      await authService.logout("some-token");

      expect(mocks.mockRefreshTokensRepo.revoke).toHaveBeenCalledTimes(1);
      expect(mocks.mockRefreshTokensRepo.revoke).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe("verifyEmail", () => {
    it("throws BadRequestError if token is invalid or expired", async () => {
      mocks.mockEmailVerificationTokensRepo.consumeByHash.mockResolvedValue(undefined);

      await expect(authService.verifyEmail({ token: "bad-token" }, mockJwt)).rejects.toBeInstanceOf(
        BadRequestError
      );
    });

    it("throws BadRequestError if user not found", async () => {
      mocks.mockEmailVerificationTokensRepo.consumeByHash.mockResolvedValue({
        id: "token-id",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });
      mocks.mockUsersRepo.findById.mockResolvedValue(undefined);

      await expect(
        authService.verifyEmail({ token: "valid-token" }, mockJwt)
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("throws BadRequestError if email already verified", async () => {
      mocks.mockEmailVerificationTokensRepo.consumeByHash.mockResolvedValue({
        id: "token-id",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });
      mocks.mockUsersRepo.findById.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: new Date("2025-06-01"),
      });

      await expect(
        authService.verifyEmail({ token: "used-token" }, mockJwt)
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("verifies email and returns auth tokens", async () => {
      mocks.mockEmailVerificationTokensRepo.consumeByHash.mockResolvedValue({
        id: "token-id",
        userId: mockUser.id,
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });
      mocks.mockUsersRepo.findById.mockResolvedValue({ ...mockUser, emailVerifiedAt: null });
      mocks.mockUsersRepo.markEmailVerified.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: new Date(),
      });
      mocks.mockProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      mocks.mockRefreshTokensRepo.create.mockResolvedValue({} as RefreshToken);

      const result = await authService.verifyEmail({ token: "valid-token" }, mockJwt);

      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toMatch(/^access-token-/);
      expect(result.refreshToken).toMatch(/^refresh-token-/);
      expect(mocks.mockUsersRepo.markEmailVerified).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("resendVerification", () => {
    it("does nothing if user does not exist", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue(undefined);

      await authService.resendVerification({ email: "nobody@example.com" });

      expect(mocks.mockEmailVerificationTokensRepo.create).not.toHaveBeenCalled();
    });

    it("does nothing if user is already verified", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: new Date("2025-06-01"),
      });

      await authService.resendVerification({ email: mockUser.email });

      expect(mocks.mockEmailVerificationTokensRepo.invalidateUserTokens).not.toHaveBeenCalled();
      expect(mocks.mockEmailVerificationTokensRepo.create).not.toHaveBeenCalled();
    });

    it("invalidates old tokens and sends new verification email", async () => {
      mocks.mockUsersRepo.findByEmail.mockResolvedValue({ ...mockUser, emailVerifiedAt: null });
      mocks.mockEmailVerificationTokensRepo.invalidateUserTokens.mockResolvedValue(undefined);
      mocks.mockEmailVerificationTokensRepo.create.mockResolvedValue({
        id: "new-token-id",
        userId: mockUser.id,
        tokenHash: "new-hash",
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
      });

      await authService.resendVerification({ email: mockUser.email });

      const invalidateOrder =
        mocks.mockEmailVerificationTokensRepo.invalidateUserTokens.mock.invocationCallOrder[0];
      const createOrder = mocks.mockEmailVerificationTokensRepo.create.mock.invocationCallOrder[0];
      expect(invalidateOrder).toBeLessThan(createOrder);

      expect(mocks.mockEmailVerificationTokensRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockUser.id }),
        expect.anything()
      );
      expect(mocks.mockEmailVerificationTokensRepo.invalidateUserTokens).toHaveBeenCalledWith(
        mockUser.id,
        expect.anything()
      );
    });
  });
});
