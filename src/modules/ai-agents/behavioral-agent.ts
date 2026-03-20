import { z } from "zod";
import { callGemini, sanitizeJsonString } from "./gemini-client.js";
import { langInstruction } from "./utils.js";
import { logger } from "../../core/config/logger.js";

export const behavioralAgentBehavioralSchema = z.object({
  moodDetected: z.enum(["motivated", "fatigued", "neutral", "stressed", "relaxed", "anxious"]),
  energyLevel: z.enum(["high", "medium", "low"]),
});

export const behavioralAgentResponseSchema = z.object({
  agentType: z.literal("behavioral-coach"),
  targetSkill: z.string(),
  behavioral: behavioralAgentBehavioralSchema,
  habitAlignmentScore: z.number().min(0).max(100),
  insights: z.array(z.string()),
  actionSuggestion: z.string(),
});

export type BehavioralAgentResponse = z.infer<typeof behavioralAgentResponseSchema>;
export type BehavioralAgentBehavioral = z.infer<typeof behavioralAgentBehavioralSchema>;

export type BehavioralAgentInput = {
  targetSkill: string;
  uiLanguage: string;
  journalContent: string;
  habitName?: string;
  targetFrequency?: string;
};

function buildPrompt(input: BehavioralAgentInput): string {
  const { targetSkill, uiLanguage, journalContent, habitName, targetFrequency } = input;

  return `You are a Behavioral Coach AI agent specialized in behavior change and habit coaching.
${langInstruction(uiLanguage)}

Target skill: ${targetSkill}
${habitName ? `Habit: "${habitName}"` : ""}
${targetFrequency ? `Target frequency: ${targetFrequency}` : ""}
User's journal entry: "${journalContent}"

Analyze the journal entry and provide behavioral feedback. Return ONLY valid JSON:
{
  "agentType": "behavioral-coach",
  "targetSkill": "${targetSkill}",
  "behavioral": {
    "moodDetected": "motivated|fatigued|neutral|stressed|relaxed|anxious",
    "energyLevel": "high|medium|low"
  },
  "habitAlignmentScore": 0-100,
  "insights": ["insight 1", "insight 2", "insight 3"],
  "actionSuggestion": "personalized action suggestion for the user"
}

IMPORTANT: Output must be complete, valid JSON only. No markdown.`;
}

export async function analyzeWithBehavioralAgent(
  input: BehavioralAgentInput
): Promise<BehavioralAgentResponse> {
  const rawText = await callGemini(buildPrompt(input), 4096);

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
