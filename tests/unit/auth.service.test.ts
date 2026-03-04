import { authService } from "@/modules/auth/auth.service.js";
import * as connection from "@/core/database/connection.js";
import { comparePassword } from "@/shared/utils/password.js";

jest.mock("@/shared/utils/password.js", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password"),
  comparePassword: jest.fn(),
}));

jest.mock("@/core/database/connection.js", () => ({
  getDb: jest.fn(),
}));

const mockDb = {
  transaction: jest.fn((callback: (tx: typeof mockDb) => Promise<unknown>) => callback(mockDb)),
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
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockUser]),
        }),
      }) as never;

      await expect(
        authService.register({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        })
      ).rejects.toThrow("User with this email already exists");
    });
  });

  describe("login", () => {
    it("throws if user is not found", async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }) as never;

      await expect(
        authService.login({ email: "nobody@example.com", password: "pass" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("throws if password is wrong", async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockUser]),
        }),
      }) as never;
      mockCompare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "test@example.com", password: "wrong" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("returns auth response for valid credentials", async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockUser]),
        }),
      }) as never;
      mockCompare.mockResolvedValue(true);

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockProfile]),
          }),
        }),
      }) as never;

      const result = await authService.login({
        email: "test@example.com",
        password: "password123",
        ui_lang: "en-US",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.id).toBe(mockUser.id);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(result.user.ui_lang).toBe("pt-BR");
    });
  });
});
