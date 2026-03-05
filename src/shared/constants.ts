const TOKEN_EXPIRES_MAP: Record<string, number> = {
  "15m": 15 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const MAX_ACTIVE_HABITS = 5;
export const WARN_ACTIVE_HABITS = 3;
export const BCRYPT_ROUNDS = 12;
export const ACCESS_TOKEN_EXPIRES = "15m";
export const REFRESH_TOKEN_EXPIRES = "7d";
export const REFRESH_TOKEN_EXPIRES_MS = TOKEN_EXPIRES_MAP[REFRESH_TOKEN_EXPIRES];
