import { isSameDay } from "./date.js";

type RateLimitProfile = {
  aiRequestsToday: number;
  lastAiRequest: Date | null;
};

export function nextAiRequestCount({ aiRequestsToday, lastAiRequest }: RateLimitProfile): number {
  const sameDay = lastAiRequest && isSameDay(lastAiRequest, new Date());
  return sameDay ? aiRequestsToday + 1 : 1;
}
