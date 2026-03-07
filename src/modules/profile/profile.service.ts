import type { ProfileRepository } from "./profile.repository.js";
import { NotFoundError } from "../../shared/errors/index.js";
import { DEFAULT_UI_LANGUAGE } from "../../shared/constants.js";
import type { UpdateProfileInput, ProfileResponse } from "./profile.types.js";

type ProfileServiceDeps = {
  profileRepo: ProfileRepository;
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

export function createProfileService({ profileRepo }: ProfileServiceDeps) {
  return {
    async getProfile(userId: string): Promise<ProfileResponse> {
      const result = await profileRepo.findByUserId(userId);
      if (!result) throw new NotFoundError("Profile not found");

      return toProfileResponse(result.user, result.profile);
    },

    async updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResponse> {
      const { name, avatarUrl, uiLanguage, bio, timezone } = input;

      const [updatedUser, updatedProfile] = await Promise.all([
        profileRepo.updateUser(userId, { name, avatarUrl }),
        profileRepo.upsertProfile(userId, { uiLanguage, bio, timezone }),
      ]);

      const result = await profileRepo.findByUserId(userId);
      if (!result) throw new NotFoundError("Profile not found");

      return toProfileResponse(updatedUser ?? result.user, updatedProfile ?? result.profile);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
