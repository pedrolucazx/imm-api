import { z } from "zod";
import { sanitizeJsonString } from "../../shared/utils/json.js";
import { langInstruction } from "../../shared/utils/ai-prompt.js";
import { logger } from "../../core/config/logger.js";
import type { TextAIProvider } from "../../core/ai/text-ai.interface.js";

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

function buildPrompt(input: LanguageAgentInput): string {
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

export async function analyzeWithLanguageAgent(
  input: LanguageAgentInput,
  textAI: TextAIProvider
): Promise<LanguageAgentResponse> {
  const rawText = await textAI.generate(buildPrompt(input), 4096);

  let parsed: unknown;
  try {
    const sanitized = sanitizeJsonString(rawText);
    parsed = JSON.parse(sanitized);
  } catch {
    logger.error({ rawTextLength: rawText.length }, "[language-agent] Failed to parse AI response");
    throw new Error("Invalid JSON response from AI");
  }

  const result = languageAgentResponseSchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ errors: result.error.issues }, "[language-agent] Invalid response schema");
    throw new Error("Invalid response schema from Language Agent");
  }

  return result.data;
}
