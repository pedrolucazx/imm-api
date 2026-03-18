import { logger } from "../../core/config/logger.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const multipliers: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseMs(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    logger.warn({ expiresIn }, "[parseMs] Invalid duration format, defaulting to 7 days");
    return SEVEN_DAYS_MS;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  return value * multipliers[unit];
}
