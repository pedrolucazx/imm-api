import { eq } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import {
  userProfiles,
  type NewUserProfile,
  type UserProfile,
} from "../../core/database/schema/index.js";

type MutableUserProfileFields = Omit<NewUserProfile, "id" | "userId">;

export function createUserProfilesRepository(db: DrizzleDb) {
  return {
    async create(data: NewUserProfile): Promise<UserProfile> {
      const [profile] = await db.insert(userProfiles).values(data).returning();
      return profile;
    },

    async findByUserId(userId: string, tx?: DbClient): Promise<UserProfile | undefined> {
      const client = tx ?? db;
      const [profile] = await client
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      return profile;
    },

    async update(
      userId: string,
      data: Partial<MutableUserProfileFields>
    ): Promise<UserProfile | undefined> {
      const hasValidField = Object.values(data).some((v) => v !== undefined);
      if (!hasValidField) return undefined;

      const [profile] = await db
        .update(userProfiles)
        .set(data)
        .where(eq(userProfiles.userId, userId))
        .returning();
      return profile;
    },

    async upsert(
      userId: string,
      data: Partial<MutableUserProfileFields>,
      tx?: DbClient
    ): Promise<UserProfile | undefined> {
      const client = tx ?? db;
      const fields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as Partial<MutableUserProfileFields>;
      if (Object.keys(fields).length === 0) return undefined;

      const [profile] = await client
        .insert(userProfiles)
        .values({ userId, ...fields })
        .onConflictDoUpdate({ target: userProfiles.userId, set: fields })
        .returning();
      return profile;
    },
  };
}

export type UserProfilesRepository = ReturnType<typeof createUserProfilesRepository>;
