import { createRefreshTokensRepository } from "@/modules/auth/refresh-tokens.repository.js";
import type { DrizzleDb } from "@/core/database/connection.js";

const mockToken = {
  id: "00000000-0000-0000-0000-000000000010",
  userId: "00000000-0000-0000-0000-000000000001",
  tokenHash: "sha256hash",
  expiresAt: new Date(Date.now() + 86400000),
  revokedAt: null,
  userAgent: null,
};

function makeInsertDb(result: unknown[]) {
  const returning = jest.fn().mockResolvedValue(result);
  const values = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values });
  return { db: { insert } as unknown as DrizzleDb, mocks: { insert, values, returning } };
}

function makeSelectDb(result: unknown[]) {
  const limit = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { db: { select } as unknown as DrizzleDb, mocks: { select, from, where, limit } };
}

function makeUpdateDb(result: unknown[]) {
  const returning = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ returning });
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  const transaction = jest
    .fn()
    .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({ update }));
  return {
    db: { update, transaction } as unknown as DrizzleDb,
    mocks: { update, set, where, returning },
  };
}

function makeRevokeDb() {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  return { db: { update } as unknown as DrizzleDb, mocks: { update, set, where } };
}

function makeDeleteDb() {
  const where = jest.fn().mockResolvedValue(undefined);
  const del = jest.fn().mockReturnValue({ where });
  return { db: { delete: del } as unknown as DrizzleDb, mocks: { delete: del, where } };
}

describe("RefreshTokensRepository.create", () => {
  it("inserts and returns the created token", async () => {
    const { db, mocks } = makeInsertDb([mockToken]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.create({
      userId: mockToken.userId,
      tokenHash: mockToken.tokenHash,
      expiresAt: mockToken.expiresAt,
    });

    expect(result).toEqual(mockToken);
    expect(mocks.values).toHaveBeenCalledWith({
      userId: mockToken.userId,
      tokenHash: mockToken.tokenHash,
      expiresAt: mockToken.expiresAt,
    });
  });
});

describe("RefreshTokensRepository.findByHash", () => {
  it("returns token when found", async () => {
    const { db, mocks } = makeSelectDb([mockToken]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.findByHash(mockToken.tokenHash);

    expect(result).toEqual(mockToken);
    expect(mocks.where).toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("returns undefined when not found", async () => {
    const { db } = makeSelectDb([]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.findByHash("unknown-hash");

    expect(result).toBeUndefined();
  });
});

describe("RefreshTokensRepository.consumeActiveByHash", () => {
  it("returns the token after consuming it", async () => {
    const { db, mocks } = makeUpdateDb([mockToken]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.consumeActiveByHash(mockToken.tokenHash);

    expect(result).toEqual(mockToken);
    expect(mocks.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
    expect(mocks.where).toHaveBeenCalled();
  });

  it("returns undefined when token not found or already consumed", async () => {
    const { db } = makeUpdateDb([]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.consumeActiveByHash("revoked-hash");

    expect(result).toBeUndefined();
  });
});

describe("RefreshTokensRepository.revoke", () => {
  it("updates revokedAt with the correct filter", async () => {
    const { db, mocks } = makeRevokeDb();
    const repo = createRefreshTokensRepository(db);

    await expect(repo.revoke(mockToken.tokenHash)).resolves.toBeUndefined();

    expect(mocks.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
    expect(mocks.where).toHaveBeenCalled();
  });
});

describe("RefreshTokensRepository.deleteExpired", () => {
  it("deletes expired tokens using a where predicate", async () => {
    const { db, mocks } = makeDeleteDb();
    const repo = createRefreshTokensRepository(db);

    await expect(repo.deleteExpired()).resolves.toBeUndefined();

    expect(mocks.where).toHaveBeenCalled();
  });
});
