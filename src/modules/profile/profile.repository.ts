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

const DEFAULT_PROFILE_FIELDS = {
  uiLanguage: "pt-BR",
  bio: null,
  timezone: "America/Sao_Paulo",
  aiRequestsToday: 0,
  lastAiRequest: null,
} as const;

export function createProfileRepository(db: DrizzleDb) {
  return {
    async findByUserId(userId: string): Promise<ProfileWithUser | undefined> {
      const [row] = await db
        .select()
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(eq(users.id, userId));

      if (!row) return undefined;

      const profile: UserProfile = row.user_profiles ?? {
        id: "",
        userId,
        ...DEFAULT_PROFILE_FIELDS,
      };

      return { user: row.users, profile };
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
      data: Pick<UpdateProfileInput, "uiLanguage" | "bio" | "timezone">,
      tx?: DrizzleDb
    ): Promise<UserProfile> {
      const client = tx ?? db;
      const hasValidField = Object.values(data).some((v) => v !== undefined);

      if (!hasValidField) {
        const [existing] = await client
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId));

        return existing ?? { id: "", userId, ...DEFAULT_PROFILE_FIELDS };
      }

      const [profile] = await client
        .insert(userProfiles)
        .values({ userId, ...data })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: data,
        })
        .returning();

      return profile;
    },

    async updateProfileAtomic(
      userId: string,
      userData: { name?: string; avatarUrl?: string },
      profileData: Pick<UpdateProfileInput, "uiLanguage" | "bio" | "timezone">
    ): Promise<{ user: User | undefined; profile: UserProfile }> {
      return db.transaction(async (tx) => {
        const hasUserFields = Object.values(userData).some((v) => v !== undefined);
        let user: User | undefined;

        if (hasUserFields) {
          const [updated] = await tx
            .update(users)
            .set({ ...userData, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();
          user = updated;
        }

        if (!user) {
          const [existing] = await tx.select().from(users).where(eq(users.id, userId));
          user = existing;
        }

        const hasProfileFields = Object.values(profileData).some((v) => v !== undefined);

        let profile: UserProfile;
        if (hasProfileFields) {
          const [upserted] = await tx
            .insert(userProfiles)
            .values({ userId, ...profileData })
            .onConflictDoUpdate({
              target: userProfiles.userId,
              set: profileData,
            })
            .returning();
          profile = upserted;
        } else {
          const [existing] = await tx
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.userId, userId));
          profile = existing ?? { id: "", userId, ...DEFAULT_PROFILE_FIELDS };
        }

        return { user, profile };
      });
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
