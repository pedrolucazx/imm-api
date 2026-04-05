import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AIRateLimitError, AITemporaryError } from "../errors.js";
import type { TextAIProvider, AIGenerateOptions } from "../text-ai.interface.js";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5_000;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

async function callOnce(
  apiKey: string,
  prompt: string,
  maxOutputTokens: number,
  options?: AIGenerateOptions
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
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
          ...(options?.responseSchema ? { responseSchema: options.responseSchema } : {}),
        },
      }),
    });

    if (response.status === 429) {
      throw new AIRateLimitError("Gemini rate limit exceeded");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new AITemporaryError(
        `Gemini API temporary error: ${response.status} - ${errorText}`,
        "upstream"
      );
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty response");

    return text;
  } catch (error) {
    if (error instanceof AIRateLimitError || error instanceof AITemporaryError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AITemporaryError(`Gemini API timeout after ${TIMEOUT_MS}ms`, "timeout");
    }
    if (error instanceof TypeError) {
      throw new AITemporaryError(`Gemini API request failed: ${error.message}`, "network");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class GeminiTextProvider implements TextAIProvider {
  async generate(
    prompt: string,
    maxOutputTokens: number,
    options?: AIGenerateOptions
  ): Promise<string> {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await callOnce(apiKey, prompt, maxOutputTokens, options);
      } catch (error) {
        if (error instanceof AIRateLimitError && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_MS * 2 ** attempt;
          logger.warn(
            `[gemini-text] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error("GeminiTextProvider: exhausted retries without result");
  }
}
