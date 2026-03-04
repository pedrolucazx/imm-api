import { authService } from "@/modules/auth/auth.service.js";
import { usersRepository } from "@/modules/users/users.repository.js";
import { userProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import { comparePassword } from "@/shared/utils/password.js";

jest.mock("@/shared/utils/password.js", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password"),
  comparePassword: jest.fn(),
}));

jest.mock("@/modules/users/users.repository.js", () => ({
  usersRepository: {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("@/modules/users/user-profiles.repository.js", () => ({
  userProfilesRepository: {
    create: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  },
}));

const mockRepo = usersRepository as jest.Mocked<typeof usersRepository>;
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
  });

  describe("register", () => {
    it("throws if user with email already exists", async () => {
      mockRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        })
      ).rejects.toThrow("User with this email already exists");

      expect(mockRepo.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("creates user and returns auth response without passwordHash", async () => {
      mockRepo.findByEmail.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue({
        ...mockUser,
        email: "new@example.com",
        name: "New User",
      });
      mockProfilesRepo.create.mockResolvedValue(mockProfile);

      const result = await authService.register({
        email: "new@example.com",
        password: "password123",
        name: "New User",
      });

      expect(result.user.email).toBe("new@example.com");
      expect(result.user.name).toBe("New User");
      expect(result.user).not.toHaveProperty("passwordHash");
    });
  });

  describe("login", () => {
    it("throws if user is not found", async () => {
      mockRepo.findByEmail.mockResolvedValue(undefined);

      await expect(
        authService.login({ email: "nobody@example.com", password: "pass" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("throws if password is wrong", async () => {
      mockRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "test@example.com", password: "wrong" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("returns auth response for valid credentials", async () => {
      mockRepo.findByEmail.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockProfilesRepo.findByUserId.mockResolvedValue(mockProfile);

      const result = await authService.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user).not.toHaveProperty("passwordHash");
    });
  });
});
