import { logger } from "../../core/config/logger.js";

export function getTodayUTCString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export function isSameDayInTimezone(a: Date, b: Date, timezone: string): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(a) === fmt.format(b);
  } catch (err) {
    logger.warn({ timezone, err }, "isSameDayInTimezone: invalid timezone, falling back to UTC");
    return isSameDay(a, b);
  }
}
