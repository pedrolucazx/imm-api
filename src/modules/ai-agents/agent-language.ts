import { z } from "zod";

/**
 * Schema for error details in language learning feedback.
 */
export const languageAgentErrorSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});

/**
 * Schema for linguistic analysis scores.
 */
export const languageAgentLinguisticSchema = z.object({
  grammarScore: z.number().min(0).max(100),
  vocabularyScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
});

/**
 * Schema for complete Language Teacher agent response.
 */
export const languageAgentResponseSchema = z.object({
  agentType: z.literal("language-teacher"),
  targetSkill: z.string(),
  linguistic: languageAgentLinguisticSchema,
  errors: z.array(languageAgentErrorSchema),
  modelSentence: z.string(),
  nextChallenge: z.string(),
});

/**
 * Type inferred from languageAgentResponseSchema
 */
export type LanguageAgentResponse = z.infer<typeof languageAgentResponseSchema>;

/**
 * Type inferred from languageAgentErrorSchema
 */
export type LanguageAgentError = z.infer<typeof languageAgentErrorSchema>;

/**
 * Type inferred from languageAgentLinguisticSchema
 */
export type LanguageAgentLinguistic = z.infer<typeof languageAgentLinguisticSchema>;

/**
 * Input required for analyzing a journal entry with Language Teacher agent.
 */
export type LanguageAgentInput = {
  targetSkill: string;
  uiLanguage: string;
  journalContent: string;
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
 * Builds a prompt for the Gemini API to analyze a journal entry with Language Teacher.
 * @param input - The input data including target language and journal content
 * @returns Formatted prompt string for Gemini
 */
export function buildLanguageAgentPrompt(input: LanguageAgentInput): string {
  return `You are a Language Teacher AI agent specialized in language learning analysis.
${langInstruction(input.uiLanguage)}

Target language: ${input.targetSkill}
User's journal entry: "${input.journalContent}"

Analyze the journal entry and provide feedback. Return ONLY valid JSON:
{
  "agentType": "language-teacher",
  "targetSkill": "${input.targetSkill}",
  "linguistic": {
    "grammarScore": 0-100,
    "vocabularyScore": 0-100,
    "fluencyScore": 0-100
  },
  "errors": [
    { "original": "incorrect phrase", "corrected": "correct phrase", "explanation": "brief explanation" }
  ],
  "modelSentence": "example sentence in ${input.targetSkill}",
  "nextChallenge": "personalized next challenge for the user"
}

IMPORTANT: Output must be complete, valid JSON only. No markdown.`;
}
