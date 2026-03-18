import { isSameDay } from "../utils/date.js";
import { TooManyRequestsError } from "../errors/index.js";
import { MAX_AI_REQUESTS_PER_DAY, AI_RATE_LIMIT_MS } from "../constants.js";

type RateLimitProfile = {
  aiRequestsToday: number;
  lastAiRequest: Date | null;
};

export function assertAiRateLimit({ aiRequestsToday, lastAiRequest }: RateLimitProfile): void {
  if (lastAiRequest) {
    const elapsed = Date.now() - lastAiRequest.getTime();
    if (elapsed < AI_RATE_LIMIT_MS) {
      throw new TooManyRequestsError("AI rate limit: wait 5 seconds between requests");
    }
  }

  const sameDay = lastAiRequest && isSameDay(lastAiRequest, new Date());
  const currentCount = sameDay ? aiRequestsToday : 0;

  if (currentCount >= MAX_AI_REQUESTS_PER_DAY) {
    throw new TooManyRequestsError(
      `AI request limit of ${MAX_AI_REQUESTS_PER_DAY} per day exceeded`
    );
  }
}
