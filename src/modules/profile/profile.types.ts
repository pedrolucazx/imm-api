import { z } from "zod";

export const ALLOWED_UI_LANGUAGES = ["pt-BR", "en-US", "es-ES"] as const;
export type UiLanguage = (typeof ALLOWED_UI_LANGUAGES)[number];

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters" })
    .max(255, { error: "Name must be less than 255 characters" })
    .optional(),
  avatarUrl: z
    .url({ error: "Avatar URL must be a valid URL" })
    .max(500, { error: "Avatar URL must be less than 500 characters" })
    .optional(),
  uiLanguage: z
    .enum(ALLOWED_UI_LANGUAGES, {
      error: `Language must be one of: ${ALLOWED_UI_LANGUAGES.join(", ")}`,
    })
    .optional(),
  bio: z.string().max(500, { error: "Bio must be less than 500 characters" }).optional(),
  timezone: z.string().max(50, { error: "Timezone must be less than 50 characters" }).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  profile: {
    uiLanguage: string;
    bio: string | null;
    timezone: string;
    aiRequestsToday: number;
  };
}
