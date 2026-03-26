export type RateLimitProfile = {
  aiRequestsToday: number;
  lastAiRequest: Date | null;
  timezone: string;
};
