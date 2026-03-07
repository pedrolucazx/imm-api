import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../../core/database/connection.js";
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

    async findById(id: string): Promise<User | undefined> {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
