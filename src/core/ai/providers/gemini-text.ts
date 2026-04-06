import { env } from "../../config/env.js";
import { AIRateLimitError, AITemporaryError } from "../errors.js";
import type { TextAIProvider, AIGenerateOptions } from "../text-ai.interface.js";

const TIMEOUT_MS = 30_000;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

async function callOnce(
  apiKey: string,
  prompt: string,
  maxOutputTokens: number,
  options?: AIGenerateOptions
): Promise<string> {
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
      ...(options?.responseSchema
        ? {
            responseMimeType: "application/json",
            responseSchema: options.responseSchema,
          }
        : {}),
    },
  });

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
      body: requestBody,
    });

    if (response.status === 429) {
      throw new AIRateLimitError("Gemini rate limit exceeded");
    }

    if (response.status >= 500) {
      const errorText = await response.text();
      throw new AITemporaryError(
        `Gemini API temporary error: ${response.status} - ${errorText}`,
        "upstream"
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
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
    return callOnce(apiKey, prompt, maxOutputTokens, options);
  }
}
