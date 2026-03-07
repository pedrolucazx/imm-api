import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../../core/database/connection.js";
import { users, userProfiles } from "../../core/database/schema/index.js";
import type { User } from "../../core/database/schema/users.schema.js";
import type { UserProfile } from "../../core/database/schema/user-profiles.schema.js";
import type { UpdateProfileInput } from "./profile.types.js";

export type ProfileWithUser = {
  user: User;
  profile: UserProfile;
};

export function createProfileRepository(db: DrizzleDb) {
  return {
    async findByUserId(userId: string): Promise<ProfileWithUser | undefined> {
      const [row] = await db
        .select()
        .from(users)
        .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(eq(users.id, userId));

      if (!row) return undefined;

      return { user: row.users, profile: row.user_profiles };
    },

    async updateUser(
      userId: string,
      data: { name?: string; avatarUrl?: string }
    ): Promise<User | undefined> {
      const hasValidField = Object.values(data).some((v) => v !== undefined);
      if (!hasValidField) return undefined;

      const [user] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      return user;
    },

    async upsertProfile(
      userId: string,
      data: Pick<UpdateProfileInput, "uiLanguage" | "bio" | "timezone">
    ): Promise<UserProfile> {
      const hasValidField = Object.values(data).some((v) => v !== undefined);

      if (!hasValidField) {
        const [existing] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId));
        return existing;
      }

      const [profile] = await db
        .insert(userProfiles)
        .values({ userId, ...data })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: data,
        })
        .returning();

      return profile;
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
