import { env } from "../core/config/env.js";

const REFRESH_TOKEN_EXPIRES_MS = parseMs(env.JWT_REFRESH_EXPIRES);

function parseMs(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || 1);
}

export const MAX_ACTIVE_HABITS = 5;
export const AI_RATE_LIMIT_MS = 5_000;
export const WARN_ACTIVE_HABITS = 3;
export const MAX_HABIT_DAYS = 66;
export const MAX_AI_REQUESTS_PER_DAY = 15;
export const GEMINI_TIMEOUT_MS = 30_000;
export const GEMINI_MAX_RETRIES = 3;
export const GEMINI_RETRY_BASE_MS = 5_000;
export const BCRYPT_ROUNDS = 12;
export const ACCESS_TOKEN_EXPIRES = env.JWT_ACCESS_EXPIRES;
export const REFRESH_TOKEN_EXPIRES = env.JWT_REFRESH_EXPIRES;
export const DEFAULT_UI_LANGUAGE = "pt-BR";
export const PG_DUPLICATE_KEY_CODE = "23505";
export const API_VERSION = "1.0.0";
export { REFRESH_TOKEN_EXPIRES_MS };
