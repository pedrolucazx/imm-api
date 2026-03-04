import { eq } from "drizzle-orm";
import { getDb } from "../../core/database/connection.js";
import { users, type NewUser, type User } from "../../core/database/schema/index.js";

export class UsersRepository {
  async create(data: NewUser): Promise<User> {
    const [user] = await getDb().insert(users).values(data).returning();
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.email, email));
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.id, id));
    return user;
  }
}

export const usersRepository = new UsersRepository();
