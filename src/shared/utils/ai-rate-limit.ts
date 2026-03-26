import { isSameDayInTimezone } from "./date.js";

type RateLimitProfile = {
  aiRequestsToday: number;
  lastAiRequest: Date | null;
  timezone: string;
};

export function nextAiRequestCount({
  aiRequestsToday,
  lastAiRequest,
  timezone,
}: RateLimitProfile): number {
  const sameDay = lastAiRequest && isSameDayInTimezone(lastAiRequest, new Date(), timezone);
  return sameDay ? aiRequestsToday + 1 : 1;
}
