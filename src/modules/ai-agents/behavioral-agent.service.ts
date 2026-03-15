import { env } from "../../core/config/env.js";
import { logger } from "../../core/config/logger.js";
import {
  behavioralAgentResponseSchema,
  buildBehavioralAgentPrompt,
  type BehavioralAgentInput,
  type BehavioralAgentResponse,
} from "./agent-behavioral.js";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

const GEMINI_TIMEOUT_MS = 30_000;
const GEMINI_MAX_RETRIES = 3;
const GEMINI_RETRY_BASE_MS = 5_000;

class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

async function callGeminiOnce(
  apiKey: string,
  prompt: string,
  maxOutputTokens: number
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  clearTimeout(timeout);

  if (response.status === 429) {
    throw new GeminiRateLimitError("Gemini rate limit exceeded");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");

  return text;
}

async function callGemini(prompt: string, maxOutputTokens: number): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(apiKey, prompt, maxOutputTokens);
    } catch (error) {
      if (error instanceof GeminiRateLimitError && attempt < GEMINI_MAX_RETRIES) {
        const delay = GEMINI_RETRY_BASE_MS * 2 ** attempt;
        logger.warn(
          `[behavioral-agent] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${GEMINI_MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable: loop always exits via return or throw");
}

function sanitizeJsonString(text: string): string {
  let cleaned = text.replace(/^```json\n?|\n?```$/g, "").trim();
  cleaned = cleaned.replace(/^```\n?|\n?```$/g, "").trim();
  cleaned = cleaned.replace(/: '([\s\S]*?)'(?=[,}\]])/g, ': "$1"');
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  cleaned = cleaned.replace(/"\s+/g, '" ').replace(/\s+"/g, ' "');
  return cleaned;
}

export async function analyzeWithBehavioralAgent(
  input: BehavioralAgentInput
): Promise<BehavioralAgentResponse> {
  const prompt = buildBehavioralAgentPrompt(input);
  const rawText = await callGemini(prompt, 4096);

  let parsed: unknown;
  try {
    const sanitized = sanitizeJsonString(rawText);
    parsed = JSON.parse(sanitized);
  } catch {
    logger.error(
      { rawTextLength: rawText.length },
      "[behavioral-agent] Failed to parse Gemini response"
    );
    throw new Error("Invalid JSON response from Gemini");
  }

  const result = behavioralAgentResponseSchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ errors: result.error.issues }, "[behavioral-agent] Invalid response schema");
    throw new Error("Invalid response schema from Behavioral Agent");
  }

  return result.data;
}
