import { logger } from "../config/logger.js";
import { AIRateLimitError, AITemporaryError } from "./errors.js";
import type { TextAIProvider, AIGenerateOptions } from "./text-ai.interface.js";
import type { TranscriptionProvider } from "./transcription.interface.js";

function isRetriable(error: unknown): boolean {
  return error instanceof AIRateLimitError || error instanceof AITemporaryError;
}

export function withTextAIFallback(providers: TextAIProvider[]): TextAIProvider {
  if (providers.length === 0) throw new Error("withTextAIFallback: providers list is empty");
  if (providers.length === 1) return providers[0];

  return {
    async generate(
      prompt: string,
      maxOutputTokens: number,
      options?: AIGenerateOptions
    ): Promise<string> {
      for (let i = 0; i < providers.length; i++) {
        try {
          return await providers[i].generate(prompt, maxOutputTokens, options);
        } catch (e) {
          if (!isRetriable(e) || i === providers.length - 1) throw e;
          logger.warn(`[ai-fallback] Text AI provider ${i + 1} failed, trying provider ${i + 2}`);
        }
      }
      throw new Error("withTextAIFallback: unreachable");
    },
  };
}

export function withTranscriptionFallback(
  providers: TranscriptionProvider[]
): TranscriptionProvider {
  if (providers.length === 0) throw new Error("withTranscriptionFallback: providers list is empty");
  if (providers.length === 1) return providers[0];

  return {
    async transcribe(
      audioBase64: string,
      mimeType: string,
      prompt: string,
      maxOutputTokens: number
    ): Promise<string> {
      for (let i = 0; i < providers.length; i++) {
        try {
          return await providers[i].transcribe(audioBase64, mimeType, prompt, maxOutputTokens);
        } catch (e) {
          if (!isRetriable(e) || i === providers.length - 1) throw e;
          logger.warn(
            `[ai-fallback] Transcription provider ${i + 1} failed, trying provider ${i + 2}`
          );
        }
      }
      throw new Error("withTranscriptionFallback: unreachable");
    },
  };
}
