import { eq } from "drizzle-orm";
import { createUsersRepository } from "@/modules/users/users.repository.js";
import { users } from "@/core/database/schema/users.schema.js";
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

function makeDb(selectResult = [mockUser]) {
  const where = jest.fn().mockResolvedValue(selectResult);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const returning = jest.fn().mockResolvedValue([mockUser]);
  const values = jest.fn().mockReturnValue({ returning });
  const insert = jest.fn().mockReturnValue({ values });

  const deleteMock = jest.fn().mockResolvedValue([]);
  const deleteFn = jest.fn().mockReturnValue({ where: deleteMock });

  return {
    db: { select, insert, delete: deleteFn } as unknown as DrizzleDb,
    mocks: { select, from, where, insert, values, returning, delete: deleteMock },
  };
}

describe("UsersRepository.create", () => {
  it("inserts and returns the created user", async () => {
    const { db, mocks } = makeDb();
    const repo = createUsersRepository(db);

    const result = await repo.create({
      email: mockUser.email,
      passwordHash: mockUser.passwordHash,
      name: mockUser.name,
    });

    expect(result).toEqual(mockUser);
    expect(mocks.values).toHaveBeenCalledWith({
      email: mockUser.email,
      passwordHash: mockUser.passwordHash,
      name: mockUser.name,
    });
    expect(mocks.returning).toHaveBeenCalled();
  });
});

describe("UsersRepository.findByEmail", () => {
  it("returns user when found", async () => {
    const { db, mocks } = makeDb([mockUser]);
    const repo = createUsersRepository(db);

    const result = await repo.findByEmail("test@example.com");

    expect(result).toEqual(mockUser);
    expect(mocks.select).toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalled();
    expect(mocks.where).toHaveBeenCalledWith(eq(users.email, "test@example.com"));
  });

  it("returns undefined when not found", async () => {
    const { db } = makeDb([]);
    const repo = createUsersRepository(db);

    const result = await repo.findByEmail("nobody@example.com");

    expect(result).toBeUndefined();
  });
});

describe("UsersRepository.findById", () => {
  it("returns user when found", async () => {
    const { db, mocks } = makeDb([mockUser]);
    const repo = createUsersRepository(db);

    const result = await repo.findById(mockUser.id);

    expect(result).toEqual(mockUser);
    expect(mocks.select).toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalled();
    expect(mocks.where).toHaveBeenCalledWith(eq(users.id, mockUser.id));
  });

  it("returns undefined when not found", async () => {
    const { db } = makeDb([]);
    const repo = createUsersRepository(db);

    const result = await repo.findById("00000000-0000-0000-0000-000000000000");

    expect(result).toBeUndefined();
  });
});

describe("UsersRepository.deleteById", () => {
  it("deletes user by id using eq filter", async () => {
    const { db, mocks } = makeDb();
    const repo = createUsersRepository(db);

    await repo.deleteById(mockUser.id);

    expect(mocks.delete).toHaveBeenCalled();
  });

  it("uses transaction client when provided", async () => {
    const { db, mocks } = makeDb();
    const repo = createUsersRepository(db);
    const tx = db as unknown;

    await repo.deleteById(mockUser.id, tx as Parameters<typeof repo.deleteById>[1]);

    expect(mocks.delete).toHaveBeenCalled();
  });
});
