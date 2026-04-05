import { env } from "../core/config/env.js";
import { parseMs } from "./utils/duration.js";

const REFRESH_TOKEN_EXPIRES_MS = parseMs(env.JWT_REFRESH_EXPIRES);

export const MAX_ACTIVE_HABITS = 5;
export const AI_RATE_LIMIT_MS = 5_000;
export const WARN_ACTIVE_HABITS = 3;
export const MAX_HABIT_DAYS = 66;
export const MAX_AI_REQUESTS_PER_DAY = 15;
export const BCRYPT_ROUNDS = 12;
export const ACCESS_TOKEN_EXPIRES = env.JWT_ACCESS_EXPIRES;
export const REFRESH_TOKEN_EXPIRES = env.JWT_REFRESH_EXPIRES;
export const DEFAULT_UI_LANGUAGE = "pt-BR";
export const PG_DUPLICATE_KEY_CODE = "23505";
export const EMAIL_VERIFICATION_TOKEN_EXPIRES_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1 hour
export const API_VERSION = "1.0.0";
export { REFRESH_TOKEN_EXPIRES_MS };
