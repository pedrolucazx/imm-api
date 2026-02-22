import { eq } from "drizzle-orm";
import { db } from "../../core/database/connection.js";
import { users, type NewUser, type User } from "../../core/database/schema/index.js";

export class UsersRepository {
  /**
   * Create a new user
   */
  async create(data: NewUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
}

export const usersRepository = new UsersRepository();
