import { z } from "zod";

export const languageAgentErrorSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});

export const languageAgentLinguisticSchema = z.object({
  grammarScore: z.number().min(0).max(100),
  vocabularyScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
});

export const languageAgentResponseSchema = z.object({
  agentType: z.literal("language-teacher"),
  targetSkill: z.string(),
  linguistic: languageAgentLinguisticSchema,
  errors: z.array(languageAgentErrorSchema),
  modelSentence: z.string(),
  nextChallenge: z.string(),
});

export type LanguageAgentResponse = z.infer<typeof languageAgentResponseSchema>;
export type LanguageAgentError = z.infer<typeof languageAgentErrorSchema>;
export type LanguageAgentLinguistic = z.infer<typeof languageAgentLinguisticSchema>;

export type LanguageAgentInput = {
  targetSkill: string;
  uiLanguage: string;
  journalContent: string;
};

function langInstruction(uiLanguage: string): string {
  return `IMPORTANT: Write ALL text fields in the language with code "${uiLanguage}".`;
}

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
