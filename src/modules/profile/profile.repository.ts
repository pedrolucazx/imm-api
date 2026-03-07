import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../../core/database/connection.js";
import { users, userProfiles } from "../../core/database/schema/index.js";
import type { User } from "../../core/database/schema/users.schema.js";
import {
  DEFAULT_PROFILE_FIELDS,
  type UserProfile,
} from "../../core/database/schema/user-profiles.schema.js";
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
      data: { name?: string; avatarUrl?: string | null }
    ): Promise<User | undefined> {
      const fields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as Partial<typeof data>;
      if (Object.keys(fields).length === 0) return undefined;

      const [user] = await db
        .update(users)
        .set({ ...fields, updatedAt: new Date() })
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
      const fields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as Partial<typeof data>;
      const hasValidField = Object.keys(fields).length > 0;

      if (!hasValidField) {
        const [existing] = await client
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId));

        return existing ?? { id: "", userId, ...DEFAULT_PROFILE_FIELDS };
      }

      const [profile] = await client
        .insert(userProfiles)
        .values({ userId, ...fields })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: fields,
        })
        .returning();

      return profile;
    },

    async updateProfileAtomic(
      userId: string,
      userData: { name?: string; avatarUrl?: string | null },
      profileData: Pick<UpdateProfileInput, "uiLanguage" | "bio" | "timezone">
    ): Promise<{ user: User | undefined; profile: UserProfile }> {
      return db.transaction(async (tx) => {
        const hasUserFields = Object.values(userData).some((v) => v !== undefined);
        let user: User | undefined;

        if (hasUserFields) {
          const userFields = Object.fromEntries(
            Object.entries(userData).filter(([, v]) => v !== undefined)
          ) as Partial<typeof userData>;
          const [updated] = await tx
            .update(users)
            .set({ ...userFields, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();
          user = updated;
        }

        if (!user) {
          const [existing] = await tx.select().from(users).where(eq(users.id, userId));
          user = existing;
          if (!user) {
            return {
              user: undefined,
              profile: { id: "", userId, ...DEFAULT_PROFILE_FIELDS },
            };
          }
        }

        const profileFields = Object.fromEntries(
          Object.entries(profileData).filter(([, v]) => v !== undefined)
        ) as Partial<typeof profileData>;
        const hasProfileFields = Object.keys(profileFields).length > 0;

        let profile: UserProfile;
        if (hasProfileFields) {
          const [upserted] = await tx
            .insert(userProfiles)
            .values({ userId, ...profileFields })
            .onConflictDoUpdate({
              target: userProfiles.userId,
              set: profileFields,
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
