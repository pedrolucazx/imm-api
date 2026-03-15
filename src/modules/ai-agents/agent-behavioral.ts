import { z } from "zod";

/**
 * Schema for error details in language learning feedback.
 */
export const behavioralAgentErrorSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});

/**
 * Schema for behavioral analysis (mood and energy detection).
 */
export const behavioralAgentBehavioralSchema = z.object({
  moodDetected: z.enum(["motivated", "fatigued", "neutral", "stressed", "relaxed", "anxious"]),
  energyLevel: z.enum(["high", "medium", "low"]),
});

/**
 * Schema for complete Behavioral Coach agent response.
 */
export const behavioralAgentResponseSchema = z.object({
  agentType: z.literal("behavioral-coach"),
  targetSkill: z.string(),
  behavioral: behavioralAgentBehavioralSchema,
  habitAlignmentScore: z.number().min(0).max(100),
  insights: z.array(z.string()),
  actionSuggestion: z.string(),
});

/**
 * Type inferred from behavioralAgentResponseSchema
 */
export type BehavioralAgentResponse = z.infer<typeof behavioralAgentResponseSchema>;

/**
 * Type inferred from behavioralAgentBehavioralSchema
 */
export type BehavioralAgentBehavioral = z.infer<typeof behavioralAgentBehavioralSchema>;

/**
 * Input required for analyzing a journal entry with Behavioral Coach agent.
 */
export type BehavioralAgentInput = {
  targetSkill: string;
  uiLanguage: string;
  journalContent: string;
  habitName?: string;
  targetFrequency?: string;
};

/**
 * Generates language instruction based on UI language.
 * @param uiLanguage - The UI language code (e.g., "pt-BR", "en-US")
 * @returns Instruction string for the AI
 */
function langInstruction(uiLanguage: string): string {
  return `IMPORTANT: Write ALL text fields in the language with code "${uiLanguage}".`;
}

/**
 * Builds a prompt for the Gemini API to analyze a journal entry with Behavioral Coach.
 * @param input - The input data including target skill, journal content, and optional habit info
 * @returns Formatted prompt string for Gemini
 */
export function buildBehavioralAgentPrompt(input: BehavioralAgentInput): string {
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
