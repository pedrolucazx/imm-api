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
  return { insert } as unknown as DrizzleDb;
}

function makeSelectDb(result: unknown[]) {
  const limit = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { select } as unknown as DrizzleDb;
}

function makeUpdateDb(result: unknown[]) {
  const returning = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ returning });
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  const transaction = jest
    .fn()
    .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({ update }));
  return { update, transaction } as unknown as DrizzleDb;
}

function makeRevokeDb() {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  return { update } as unknown as DrizzleDb;
}

function makeDeleteDb() {
  const where = jest.fn().mockResolvedValue(undefined);
  const del = jest.fn().mockReturnValue({ where });
  return { delete: del } as unknown as DrizzleDb;
}

describe("RefreshTokensRepository.create", () => {
  it("inserts and returns the created token", async () => {
    const db = makeInsertDb([mockToken]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.create({
      userId: mockToken.userId,
      tokenHash: mockToken.tokenHash,
      expiresAt: mockToken.expiresAt,
    });

    expect(result).toEqual(mockToken);
  });
});

describe("RefreshTokensRepository.findByHash", () => {
  it("returns token when found", async () => {
    const db = makeSelectDb([mockToken]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.findByHash(mockToken.tokenHash);

    expect(result).toEqual(mockToken);
  });

  it("returns undefined when not found", async () => {
    const db = makeSelectDb([]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.findByHash("unknown-hash");

    expect(result).toBeUndefined();
  });
});

describe("RefreshTokensRepository.consumeActiveByHash", () => {
  it("returns the token after consuming it", async () => {
    const db = makeUpdateDb([mockToken]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.consumeActiveByHash(mockToken.tokenHash);

    expect(result).toEqual(mockToken);
  });

  it("returns undefined when token not found or already consumed", async () => {
    const db = makeUpdateDb([]);
    const repo = createRefreshTokensRepository(db);

    const result = await repo.consumeActiveByHash("revoked-hash");

    expect(result).toBeUndefined();
  });
});

describe("RefreshTokensRepository.revoke", () => {
  it("updates revokedAt without returning", async () => {
    const db = makeRevokeDb();
    const repo = createRefreshTokensRepository(db);

    await expect(repo.revoke(mockToken.tokenHash)).resolves.toBeUndefined();
  });
});

describe("RefreshTokensRepository.deleteExpired", () => {
  it("deletes expired tokens without returning", async () => {
    const db = makeDeleteDb();
    const repo = createRefreshTokensRepository(db);

    await expect(repo.deleteExpired()).resolves.toBeUndefined();
  });
});
