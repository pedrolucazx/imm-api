import type { DrizzleDb } from "../../core/database/connection.js";
import type { UsersRepository } from "./users.repository.js";
import type { UserProfilesRepository } from "./user-profiles.repository.js";
import { NotFoundError, UnauthorizedError } from "../../shared/errors/index.js";
import { DEFAULT_UI_LANGUAGE } from "../../shared/constants.js";
import { DEFAULT_PROFILE_FIELDS } from "../../core/database/schema/user-profiles.schema.js";
import { isSameDayInTimezone } from "../../shared/utils/date.js";
import { comparePassword } from "../../shared/utils/password.js";
import type { UpdateProfileInput, ProfileResponse } from "./users.types.js";

type UsersServiceDeps = {
  usersRepo: UsersRepository;
  userProfilesRepo: UserProfilesRepository;
  db: DrizzleDb;
};

function toProfileResponse(
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null | undefined;
    emailVerifiedAt: Date | null | undefined;
  },
  profile: {
    uiLanguage: string;
    bio: string | null | undefined;
    timezone: string;
    aiRequestsToday: number;
    lastAiRequest: Date | null | undefined;
  }
): ProfileResponse {
  const aiRequestsToday =
    profile.lastAiRequest &&
    isSameDayInTimezone(profile.lastAiRequest, new Date(), profile.timezone)
      ? profile.aiRequestsToday
      : 0;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    profile: {
      uiLanguage: profile.uiLanguage ?? DEFAULT_UI_LANGUAGE,
      bio: profile.bio ?? null,
      timezone: profile.timezone,
      aiRequestsToday,
    },
  };
}

export function createUsersService({ usersRepo, userProfilesRepo, db }: UsersServiceDeps) {
  return {
    async getProfile(userId: string): Promise<ProfileResponse> {
      const user = await usersRepo.findById(userId);
      if (!user) throw new NotFoundError("Profile not found");

      const profile =
        (await userProfilesRepo.findByUserId(userId)) ??
        ({ userId, ...DEFAULT_PROFILE_FIELDS } as const);

      return toProfileResponse(user, profile);
    },

    async updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResponse> {
      const { name, avatarUrl, uiLanguage, bio, timezone } = input;
      const hasUserFields = name !== undefined || avatarUrl !== undefined;
      const hasProfileFields =
        uiLanguage !== undefined || bio !== undefined || timezone !== undefined;

      return db.transaction(async (tx) => {
        let user = hasUserFields
          ? ((await usersRepo.update(userId, { name, avatarUrl }, tx)) ??
            (await usersRepo.findById(userId, tx)))
          : await usersRepo.findById(userId, tx);
        if (!user) throw new NotFoundError("Profile not found");

        const profile = hasProfileFields
          ? ((await userProfilesRepo.upsert(userId, { uiLanguage, bio, timezone }, tx)) ??
            ({ userId, ...DEFAULT_PROFILE_FIELDS } as const))
          : ((await userProfilesRepo.findByUserId(userId, tx)) ??
            ({ userId, ...DEFAULT_PROFILE_FIELDS } as const));

        return toProfileResponse(user, profile);
      });
    },

    async deleteAccount(userId: string, password: string): Promise<void> {
      await db.transaction(async (tx) => {
        const user = await usersRepo.findById(userId, tx);
        if (!user) throw new NotFoundError("User not found");

        const isValidPassword = await comparePassword(password, user.passwordHash);
        if (!isValidPassword) throw new UnauthorizedError("Invalid password");

        await usersRepo.deleteById(userId, tx);
      });
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
