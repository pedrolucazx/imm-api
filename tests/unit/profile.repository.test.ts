import { eq } from "drizzle-orm";
import { createProfileRepository } from "@/modules/profile/profile.repository.js";
import { users } from "@/core/database/schema/users.schema.js";
import { userProfiles } from "@/core/database/schema/user-profiles.schema.js";
import type { DrizzleDb } from "@/core/database/connection.js";

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

describe("ProfileRepository.findByUserId", () => {
  it("returns user and profile when both exist (leftJoin)", async () => {
    const joinResult = { users: mockUser, user_profiles: mockProfile };
    const where = jest.fn().mockResolvedValue([joinResult]);
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    const select = jest.fn().mockReturnValue({ from });
    const db = { select } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.findByUserId(mockUser.id);

    expect(result).toEqual({ user: mockUser, profile: mockProfile });
    expect(select).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith(users);
    expect(leftJoin).toHaveBeenCalledWith(userProfiles, eq(userProfiles.userId, users.id));
    expect(where).toHaveBeenCalledWith(eq(users.id, mockUser.id));
  });

  it("returns user with default profile when profile row is null (user exists, no profile yet)", async () => {
    const joinResult = { users: mockUser, user_profiles: null };
    const where = jest.fn().mockResolvedValue([joinResult]);
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    const select = jest.fn().mockReturnValue({ from });
    const db = { select } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.findByUserId(mockUser.id);

    expect(result).toBeDefined();
    expect(result!.user).toEqual(mockUser);
    expect(result!.profile.uiLanguage).toBe("pt-BR");
    expect(result!.profile.timezone).toBe("America/Sao_Paulo");
    expect(result!.profile.aiRequestsToday).toBe(0);
  });

  it("returns undefined when user not found", async () => {
    const where = jest.fn().mockResolvedValue([]);
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    const select = jest.fn().mockReturnValue({ from });
    const db = { select } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.findByUserId("non-existent");

    expect(result).toBeUndefined();
  });
});

describe("ProfileRepository.updateUser", () => {
  it("returns undefined when no valid fields provided", async () => {
    const db = {} as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.updateUser(mockUser.id, {});

    expect(result).toBeUndefined();
  });

  it("updates and returns user when name is provided", async () => {
    const updated = { ...mockUser, name: "New Name" };
    const returning = jest.fn().mockResolvedValue([updated]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const db = { update } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.updateUser(mockUser.id, { name: "New Name" });

    expect(result).toEqual(updated);
    expect(update).toHaveBeenCalledWith(users);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: "New Name" }));
    expect(where).toHaveBeenCalledWith(eq(users.id, mockUser.id));
  });

  it("returns undefined when no row matched", async () => {
    const returning = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const db = { update } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.updateUser("non-existent", { name: "Ghost" });

    expect(result).toBeUndefined();
  });
});

describe("ProfileRepository.upsertProfile", () => {
  it("returns existing profile when no valid fields provided", async () => {
    const where = jest.fn().mockResolvedValue([mockProfile]);
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    const db = { select } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.upsertProfile(mockUser.id, {});

    expect(result).toEqual(mockProfile);
    expect(select).toHaveBeenCalled();
  });

  it("returns default profile when no valid fields and no existing profile", async () => {
    const where = jest.fn().mockResolvedValue([]);
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    const db = { select } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.upsertProfile(mockUser.id, {});

    expect(result.uiLanguage).toBe("pt-BR");
    expect(result.timezone).toBe("America/Sao_Paulo");
    expect(result.aiRequestsToday).toBe(0);
  });

  it("upserts and returns profile with new uiLanguage", async () => {
    const updated = { ...mockProfile, uiLanguage: "en-US" };
    const returning = jest.fn().mockResolvedValue([updated]);
    const onConflictDoUpdate = jest.fn().mockReturnValue({ returning });
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = jest.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.upsertProfile(mockUser.id, { uiLanguage: "en-US" });

    expect(result).toEqual(updated);
    expect(insert).toHaveBeenCalledWith(userProfiles);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: mockUser.id, uiLanguage: "en-US" })
    );
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: userProfiles.userId,
        set: expect.objectContaining({ uiLanguage: "en-US" }),
      })
    );
  });
});

describe("ProfileRepository.updateProfileAtomic", () => {
  it("runs both user update and profile upsert inside a transaction", async () => {
    const updatedUser = { ...mockUser, name: "Atomic Name" };
    const updatedProfile = { ...mockProfile, uiLanguage: "en-US" };

    const returning = jest.fn().mockResolvedValue([updatedUser]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    const txUpdate = jest.fn().mockReturnValue({ set });

    const insertReturning = jest.fn().mockResolvedValue([updatedProfile]);
    const onConflictDoUpdate = jest.fn().mockReturnValue({ returning: insertReturning });
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    const txInsert = jest.fn().mockReturnValue({ values });

    const tx = { update: txUpdate, insert: txInsert } as unknown as DrizzleDb;
    const transaction = jest
      .fn()
      .mockImplementation((fn: (tx: DrizzleDb) => Promise<unknown>) => fn(tx));
    const db = { transaction } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.updateProfileAtomic(
      mockUser.id,
      { name: "Atomic Name" },
      { uiLanguage: "en-US" }
    );

    expect(transaction).toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledWith(users);
    expect(txInsert).toHaveBeenCalledWith(userProfiles);
    expect(result.user).toEqual(updatedUser);
    expect(result.profile).toEqual(updatedProfile);
  });

  it("fetches existing user when no user fields are provided", async () => {
    const updatedProfile = { ...mockProfile, bio: "New bio" };

    const userWhere = jest.fn().mockResolvedValue([mockUser]);
    const userFrom = jest.fn().mockReturnValue({ where: userWhere });
    const txSelect = jest.fn().mockReturnValue({ from: userFrom });

    const insertReturning = jest.fn().mockResolvedValue([updatedProfile]);
    const onConflictDoUpdate = jest.fn().mockReturnValue({ returning: insertReturning });
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    const txInsert = jest.fn().mockReturnValue({ values });

    const tx = { select: txSelect, insert: txInsert } as unknown as DrizzleDb;
    const transaction = jest
      .fn()
      .mockImplementation((fn: (tx: DrizzleDb) => Promise<unknown>) => fn(tx));
    const db = { transaction } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.updateProfileAtomic(mockUser.id, {}, { bio: "New bio" });

    expect(txSelect).toHaveBeenCalled();
    expect(result.user).toEqual(mockUser);
    expect(result.profile).toEqual(updatedProfile);
  });

  it("returns user: undefined when userId does not exist in the database", async () => {
    const updatedProfile = { ...mockProfile, bio: "No user bio" };

    // Select returns empty array — userId not found
    const userWhere = jest.fn().mockResolvedValue([]);
    const userFrom = jest.fn().mockReturnValue({ where: userWhere });
    const txSelect = jest.fn().mockReturnValue({ from: userFrom });

    const insertReturning = jest.fn().mockResolvedValue([updatedProfile]);
    const onConflictDoUpdate = jest.fn().mockReturnValue({ returning: insertReturning });
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    const txInsert = jest.fn().mockReturnValue({ values });

    const tx = { select: txSelect, insert: txInsert } as unknown as DrizzleDb;
    const transaction = jest
      .fn()
      .mockImplementation((fn: (tx: DrizzleDb) => Promise<unknown>) => fn(tx));
    const db = { transaction } as unknown as DrizzleDb;
    const repo = createProfileRepository(db);

    const result = await repo.updateProfileAtomic("non-existent-id", {}, { bio: "No user bio" });

    expect(result.user).toBeUndefined();
    expect(result.profile).toEqual(updatedProfile);
  });
});
