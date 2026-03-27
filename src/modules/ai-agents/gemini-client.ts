import { env } from "../../core/config/env.js";
import { logger } from "../../core/config/logger.js";
import {
  GEMINI_TIMEOUT_MS,
  GEMINI_MAX_RETRIES,
  GEMINI_RETRY_BASE_MS,
} from "../../shared/constants.js";
export { sanitizeJsonString } from "../../shared/utils/json.js";

export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

async function callGeminiOnce(
  apiKey: string,
  prompt: string,
  maxOutputTokens: number
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

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
          temperature: 0.7,
          maxOutputTokens,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (response.status === 429) {
      throw new GeminiRateLimitError("Gemini rate limit exceeded");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty response");

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiMultimodalOnce(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  prompt: string,
  maxOutputTokens: number
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

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
      throw new GeminiRateLimitError("Gemini rate limit exceeded");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty response");

    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function callGemini(prompt: string, maxOutputTokens: number): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  for (let attempt = 0; attempt < GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(apiKey, prompt, maxOutputTokens);
    } catch (error) {
      if (error instanceof GeminiRateLimitError && attempt < GEMINI_MAX_RETRIES - 1) {
        const delay = GEMINI_RETRY_BASE_MS * 2 ** attempt;
        logger.warn(
          `[gemini-client] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${GEMINI_MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("callGemini: exhausted retries without result");
}

export async function callGeminiMultimodal(
  audioBase64: string,
  mimeType: string,
  prompt: string,
  maxOutputTokens: number
): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  for (let attempt = 0; attempt < GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await callGeminiMultimodalOnce(apiKey, audioBase64, mimeType, prompt, maxOutputTokens);
    } catch (error) {
      if (error instanceof GeminiRateLimitError && attempt < GEMINI_MAX_RETRIES - 1) {
        const delay = GEMINI_RETRY_BASE_MS * 2 ** attempt;
        logger.warn(
          `[gemini-client] Rate limited (multimodal), retrying in ${delay}ms (attempt ${attempt + 1}/${GEMINI_MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("callGeminiMultimodal: exhausted retries without result");
}
