import { withTextAIFallback, withTranscriptionFallback } from "@/core/ai/with-fallback.js";
import { AIRateLimitError, AITemporaryError } from "@/core/ai/errors.js";
import type { TextAIProvider } from "@/core/ai/text-ai.interface.js";
import type { TranscriptionProvider } from "@/core/ai/transcription.interface.js";

function makeTextProvider(impl: () => Promise<string>): TextAIProvider {
  return { generate: jest.fn().mockImplementation(impl) };
}

function makeTranscriptionProvider(impl: () => Promise<string>): TranscriptionProvider {
  return { transcribe: jest.fn().mockImplementation(impl) };
}

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// withTextAIFallback
// ---------------------------------------------------------------------------

describe("withTextAIFallback", () => {
  it("throws when providers list is empty", () => {
    expect(() => withTextAIFallback([])).toThrow("providers list is empty");
  });

  it("returns the single provider directly when list has one entry", () => {
    const p = makeTextProvider(() => Promise.resolve("ok"));
    expect(withTextAIFallback([p])).toBe(p);
  });

  it("returns result from first provider when it succeeds", async () => {
    const p1 = makeTextProvider(() => Promise.resolve("from-p1"));
    const p2 = makeTextProvider(() => Promise.resolve("from-p2"));
    const wrapped = withTextAIFallback([p1, p2]);

    await expect(wrapped.generate("prompt", 100)).resolves.toBe("from-p1");
    expect(p2.generate).not.toHaveBeenCalled();
  });

  it("falls back to next provider on AIRateLimitError", async () => {
    const p1 = makeTextProvider(() => Promise.reject(new AIRateLimitError("rate limit")));
    const p2 = makeTextProvider(() => Promise.resolve("from-p2"));
    const wrapped = withTextAIFallback([p1, p2]);

    await expect(wrapped.generate("prompt", 100)).resolves.toBe("from-p2");
    expect(p1.generate).toHaveBeenCalledTimes(1);
    expect(p2.generate).toHaveBeenCalledTimes(1);
  });

  it("falls back to next provider on AITemporaryError", async () => {
    const p1 = makeTextProvider(() =>
      Promise.reject(new AITemporaryError("upstream down", "upstream"))
    );
    const p2 = makeTextProvider(() => Promise.resolve("from-p2"));
    const wrapped = withTextAIFallback([p1, p2]);

    await expect(wrapped.generate("prompt", 100)).resolves.toBe("from-p2");
  });

  it("rethrows immediately on non-retriable error without trying next provider", async () => {
    const nonRetriable = new Error("unexpected parse failure");
    const p1 = makeTextProvider(() => Promise.reject(nonRetriable));
    const p2 = makeTextProvider(() => Promise.resolve("from-p2"));
    const wrapped = withTextAIFallback([p1, p2]);

    await expect(wrapped.generate("prompt", 100)).rejects.toBe(nonRetriable);
    expect(p2.generate).not.toHaveBeenCalled();
  });

  it("rethrows error from last provider when all fail with retriable error", async () => {
    const err1 = new AIRateLimitError("p1 rate limit");
    const err2 = new AIRateLimitError("p2 rate limit");
    const p1 = makeTextProvider(() => Promise.reject(err1));
    const p2 = makeTextProvider(() => Promise.reject(err2));
    const wrapped = withTextAIFallback([p1, p2]);

    await expect(wrapped.generate("prompt", 100)).rejects.toBe(err2);
  });

  it("passes prompt, maxOutputTokens and options to the active provider", async () => {
    const p1 = makeTextProvider(() => Promise.resolve("ok"));
    const wrapped = withTextAIFallback([p1, makeTextProvider(() => Promise.resolve("ok"))]);
    const opts = { responseSchema: { type: "object" }, temperature: 0.4 };

    await wrapped.generate("my prompt", 8192, opts);

    expect(p1.generate).toHaveBeenCalledWith("my prompt", 8192, opts);
  });
});

// ---------------------------------------------------------------------------
// withTranscriptionFallback
// ---------------------------------------------------------------------------

describe("withTranscriptionFallback", () => {
  it("throws when providers list is empty", () => {
    expect(() => withTranscriptionFallback([])).toThrow("providers list is empty");
  });

  it("returns the single provider directly when list has one entry", () => {
    const p = makeTranscriptionProvider(() => Promise.resolve("ok"));
    expect(withTranscriptionFallback([p])).toBe(p);
  });

  it("returns result from first provider when it succeeds", async () => {
    const p1 = makeTranscriptionProvider(() => Promise.resolve("transcript-1"));
    const p2 = makeTranscriptionProvider(() => Promise.resolve("transcript-2"));
    const wrapped = withTranscriptionFallback([p1, p2]);

    await expect(wrapped.transcribe("base64", "audio/webm", "prompt", 500)).resolves.toBe(
      "transcript-1"
    );
    expect(p2.transcribe).not.toHaveBeenCalled();
  });

  it("falls back to next provider on AIRateLimitError", async () => {
    const p1 = makeTranscriptionProvider(() => Promise.reject(new AIRateLimitError("rate limit")));
    const p2 = makeTranscriptionProvider(() => Promise.resolve("transcript-2"));
    const wrapped = withTranscriptionFallback([p1, p2]);

    await expect(wrapped.transcribe("base64", "audio/webm", "prompt", 500)).resolves.toBe(
      "transcript-2"
    );
  });

  it("falls back to next provider on AITemporaryError", async () => {
    const p1 = makeTranscriptionProvider(() =>
      Promise.reject(new AITemporaryError("timeout", "timeout"))
    );
    const p2 = makeTranscriptionProvider(() => Promise.resolve("transcript-2"));
    const wrapped = withTranscriptionFallback([p1, p2]);

    await expect(wrapped.transcribe("base64", "audio/webm", "prompt", 500)).resolves.toBe(
      "transcript-2"
    );
  });

  it("rethrows immediately on non-retriable error without trying next provider", async () => {
    const nonRetriable = new Error("decode error");
    const p1 = makeTranscriptionProvider(() => Promise.reject(nonRetriable));
    const p2 = makeTranscriptionProvider(() => Promise.resolve("transcript-2"));
    const wrapped = withTranscriptionFallback([p1, p2]);

    await expect(wrapped.transcribe("base64", "audio/webm", "prompt", 500)).rejects.toBe(
      nonRetriable
    );
    expect(p2.transcribe).not.toHaveBeenCalled();
  });

  it("rethrows error from last provider when all fail with retriable error", async () => {
    const err1 = new AIRateLimitError("p1 rate limit");
    const err2 = new AIRateLimitError("p2 rate limit");
    const p1 = makeTranscriptionProvider(() => Promise.reject(err1));
    const p2 = makeTranscriptionProvider(() => Promise.reject(err2));
    const wrapped = withTranscriptionFallback([p1, p2]);

    await expect(wrapped.transcribe("base64", "audio/webm", "prompt", 500)).rejects.toBe(err2);
  });
});
