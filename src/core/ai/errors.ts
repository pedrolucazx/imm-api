export class AIRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIRateLimitError";
  }
}

export type AITemporaryErrorReason = "timeout" | "network" | "upstream";

export class AITemporaryError extends Error {
  readonly code = "AI_TEMPORARY";

  constructor(
    message: string,
    readonly reason: AITemporaryErrorReason
  ) {
    super(message);
    this.name = "AITemporaryError";
  }
}
