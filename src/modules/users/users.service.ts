import type { DrizzleDb } from "../../core/database/connection.js";
import type { UsersRepository } from "./users.repository.js";
import type { UserProfilesRepository } from "./user-profiles.repository.js";
import { NotFoundError } from "../../shared/errors/index.js";
import { DEFAULT_UI_LANGUAGE } from "../../shared/constants.js";
import { DEFAULT_PROFILE_FIELDS } from "../../core/database/schema/user-profiles.schema.js";
import type { UpdateProfileInput, ProfileResponse } from "./users.types.js";

type UsersServiceDeps = {
  usersRepo: UsersRepository;
  userProfilesRepo: UserProfilesRepository;
  db: DrizzleDb;
};

function toProfileResponse(
  user: { id: string; email: string; name: string; avatarUrl: string | null | undefined },
  profile: {
    uiLanguage: string;
    bio: string | null | undefined;
    timezone: string;
    aiRequestsToday: number;
  }
): ProfileResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    profile: {
      uiLanguage: profile.uiLanguage ?? DEFAULT_UI_LANGUAGE,
      bio: profile.bio ?? null,
      timezone: profile.timezone,
      aiRequestsToday: profile.aiRequestsToday,
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

      return db.transaction(async (tx) => {
        let user = await usersRepo.update(userId, { name, avatarUrl }, tx);
        if (!user) user = await usersRepo.findById(userId, tx);
        if (!user) throw new NotFoundError("Profile not found");

        const profile =
          (await userProfilesRepo.upsert(userId, { uiLanguage, bio, timezone }, tx)) ??
          (await userProfilesRepo.findByUserId(userId, tx)) ??
          ({ userId, ...DEFAULT_PROFILE_FIELDS } as const);

        return toProfileResponse(user, profile);
      });
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
