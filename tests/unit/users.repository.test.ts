import { createUsersRepository } from "@/modules/users/users.repository.js";
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

function makeDb(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const where = jest.fn().mockResolvedValue([mockUser]);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const returning = jest.fn().mockResolvedValue([mockUser]);
  const values = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values });

  return {
    db: { select, insert } as unknown as DrizzleDb,
    mocks: { select, from, where, insert, values, returning, ...overrides },
  };
}

describe("UsersRepository.create", () => {
  it("inserts and returns the created user", async () => {
    const { db } = makeDb();
    const repo = createUsersRepository(db);

    const result = await repo.create({
      email: mockUser.email,
      passwordHash: mockUser.passwordHash,
      name: mockUser.name,
    });

    expect(result).toEqual(mockUser);
  });
});

describe("UsersRepository.findByEmail", () => {
  it("returns user when found", async () => {
    const { db } = makeDb();
    const repo = createUsersRepository(db);

    const result = await repo.findByEmail("test@example.com");

    expect(result).toEqual(mockUser);
  });

  it("returns undefined when not found", async () => {
    const where = jest.fn().mockResolvedValue([]);
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    const db = { select } as unknown as DrizzleDb;
    const repo = createUsersRepository(db);

    const result = await repo.findByEmail("nobody@example.com");

    expect(result).toBeUndefined();
  });
});

describe("UsersRepository.findById", () => {
  it("returns user when found", async () => {
    const { db } = makeDb();
    const repo = createUsersRepository(db);

    const result = await repo.findById(mockUser.id);

    expect(result).toEqual(mockUser);
  });

  it("returns undefined when not found", async () => {
    const where = jest.fn().mockResolvedValue([]);
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    const db = { select } as unknown as DrizzleDb;
    const repo = createUsersRepository(db);

    const result = await repo.findById("00000000-0000-0000-0000-000000000000");

    expect(result).toBeUndefined();
  });
});
