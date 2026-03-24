import { eq } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import { users, type NewUser, type User } from "../../core/database/schema/index.js";

export function createUsersRepository(db: DrizzleDb) {
  return {
    async create(data: NewUser): Promise<User> {
      const [user] = await db.insert(users).values(data).returning();
      return user;
    },

    async findByEmail(email: string): Promise<User | undefined> {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    },

    async findById(id: string, tx?: DbClient): Promise<User | undefined> {
      const client = tx ?? db;
      const [user] = await client.select().from(users).where(eq(users.id, id));
      return user;
    },

    async update(
      userId: string,
      data: {
        name?: string;
        avatarUrl?: string | null;
        passwordHash?: string;
        emailVerifiedAt?: Date;
      },
      tx?: DbClient
    ): Promise<User | undefined> {
      const client = tx ?? db;
      const fields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as Partial<typeof data>;
      if (Object.keys(fields).length === 0) return undefined;

      const [user] = await client
        .update(users)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return user;
    },

    async deleteById(userId: string, tx?: DbClient): Promise<void> {
      const client = tx ?? db;
      await client.delete(users).where(eq(users.id, userId));
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
