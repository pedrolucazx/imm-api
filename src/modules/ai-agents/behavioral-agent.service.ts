import { callGemini, sanitizeJsonString } from "./gemini-client.js";
import {
  behavioralAgentResponseSchema,
  buildBehavioralAgentPrompt,
  type BehavioralAgentInput,
  type BehavioralAgentResponse,
} from "./agent-behavioral.js";
import { logger } from "../../core/config/logger.js";

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
