import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AIRateLimitError } from "../errors.js";
import type { TranscriptionProvider } from "../transcription.interface.js";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5_000;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

async function callOnce(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  prompt: string,
  maxOutputTokens: number
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(env.GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (response.status === 429) {
      throw new AIRateLimitError("Gemini rate limit exceeded");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty transcription response");

    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  async transcribe(
    audioBase64: string,
    mimeType: string,
    prompt: string,
    maxOutputTokens: number
  ): Promise<string> {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await callOnce(apiKey, audioBase64, mimeType, prompt, maxOutputTokens);
      } catch (error) {
        if (error instanceof AIRateLimitError && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_MS * 2 ** attempt;
          logger.warn(
            `[gemini-transcription] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error("GeminiTranscriptionProvider: exhausted retries without result");
  }
}
