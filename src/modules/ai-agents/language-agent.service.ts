import { callGemini, sanitizeJsonString } from "./gemini-client.js";
import {
  languageAgentResponseSchema,
  buildLanguageAgentPrompt,
  type LanguageAgentInput,
  type LanguageAgentResponse,
} from "./agent-language.js";
import { logger } from "../../core/config/logger.js";

export async function analyzeWithLanguageAgent(
  input: LanguageAgentInput
): Promise<LanguageAgentResponse> {
  const prompt = buildLanguageAgentPrompt(input);
  const rawText = await callGemini(prompt, 4096);

  let parsed: unknown;
  try {
    const sanitized = sanitizeJsonString(rawText);
    parsed = JSON.parse(sanitized);
  } catch {
    logger.error(
      { rawTextLength: rawText.length },
      "[language-agent] Failed to parse Gemini response"
    );
    throw new Error("Invalid JSON response from Gemini");
  }

  const result = languageAgentResponseSchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ errors: result.error.issues }, "[language-agent] Invalid response schema");
    throw new Error("Invalid response schema from Language Agent");
  }

  return result.data;
}
