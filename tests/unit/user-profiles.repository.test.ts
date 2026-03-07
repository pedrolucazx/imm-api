import { createUserProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import type { DrizzleDb } from "@/core/database/connection.js";

const mockProfile = {
  id: "00000000-0000-0000-0000-000000000002",
  userId: "00000000-0000-0000-0000-000000000001",
  uiLanguage: "pt-BR",
  bio: null,
  timezone: "America/Sao_Paulo",
  aiRequestsToday: 0,
  lastAiRequest: null,
};

function makeSelectDb(result: unknown[]) {
  const where = jest.fn().mockResolvedValue(result);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { db: { select } as unknown as DrizzleDb, mocks: { select, from, where } };
}

function makeInsertDb(result: unknown[]) {
  const returning = jest.fn().mockResolvedValue(result);
  const values = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values });
  return { db: { insert } as unknown as DrizzleDb, mocks: { insert, values, returning } };
}

function makeUpdateDb(result: unknown[]) {
  const returning = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ returning });
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  return { db: { update } as unknown as DrizzleDb, mocks: { update, set, where, returning } };
}

describe("UserProfilesRepository.create", () => {
  it("inserts and returns the created profile", async () => {
    const { db, mocks } = makeInsertDb([mockProfile]);
    const repo = createUserProfilesRepository(db);

    const result = await repo.create({ userId: mockProfile.userId, uiLanguage: "pt-BR" });

    expect(result).toEqual(mockProfile);
    expect(mocks.values).toHaveBeenCalledWith({ userId: mockProfile.userId, uiLanguage: "pt-BR" });
    expect(mocks.returning).toHaveBeenCalled();
  });
});

describe("UserProfilesRepository.findByUserId", () => {
  it("returns profile when found", async () => {
    const { db, mocks } = makeSelectDb([mockProfile]);
    const repo = createUserProfilesRepository(db);

    const result = await repo.findByUserId(mockProfile.userId);

    expect(result).toEqual(mockProfile);
    expect(mocks.select).toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalled();
    expect(mocks.where).toHaveBeenCalled();
  });

  it("returns undefined when not found", async () => {
    const { db } = makeSelectDb([]);
    const repo = createUserProfilesRepository(db);

    const result = await repo.findByUserId("non-existent");

    expect(result).toBeUndefined();
  });
});

describe("UserProfilesRepository.update", () => {
  it("returns undefined when data has no valid fields", async () => {
    const db = {} as unknown as DrizzleDb;
    const repo = createUserProfilesRepository(db);

    const result = await repo.update("some-id", {});

    expect(result).toBeUndefined();
  });

  it("returns updated profile when found", async () => {
    const updated = { ...mockProfile, uiLanguage: "en-US" };
    const { db, mocks } = makeUpdateDb([updated]);
    const repo = createUserProfilesRepository(db);

    const result = await repo.update(mockProfile.userId, { uiLanguage: "en-US" });

    expect(result).toEqual(updated);
    expect(mocks.set).toHaveBeenCalledWith({ uiLanguage: "en-US" });
    expect(mocks.where).toHaveBeenCalled();
  });

  it("returns undefined when no row matched", async () => {
    const { db, mocks } = makeUpdateDb([]);
    const repo = createUserProfilesRepository(db);

    const result = await repo.update("non-existent", { uiLanguage: "en-US" });

    expect(result).toBeUndefined();
    expect(mocks.set).toHaveBeenCalledWith({ uiLanguage: "en-US" });
    expect(mocks.where).toHaveBeenCalled();
  });
});
