import { isSameDayInTimezone } from "./date.js";
import type { RateLimitProfile } from "../types/rate-limit.js";

export function nextAiRequestCount({
  aiRequestsToday,
  lastAiRequest,
  timezone,
}: RateLimitProfile): number {
  const sameDay = lastAiRequest && isSameDayInTimezone(lastAiRequest, new Date(), timezone);
  return sameDay ? aiRequestsToday + 1 : 1;
}
