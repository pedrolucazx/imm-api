import {
  buildLanguageAgentPrompt,
  languageAgentResponseSchema,
  languageAgentLinguisticSchema,
  languageAgentErrorSchema,
} from "@/modules/ai-agents/agent-language.js";

describe("Language Agent", () => {
  describe("buildLanguageAgentPrompt", () => {
    it("builds prompt with target skill and journal content", () => {
      const input = {
        targetSkill: "en-US",
        uiLanguage: "pt-BR",
        journalContent: "Today I went to the market and bought some fruits.",
      };

      const prompt = buildLanguageAgentPrompt(input);

      expect(prompt).toContain("Language Teacher AI agent");
      expect(prompt).toContain("en-US");
      expect(prompt).toContain("pt-BR");
      expect(prompt).toContain("Today I went to the market and bought some fruits");
      expect(prompt).toContain("grammarScore");
      expect(prompt).toContain("vocabularyScore");
      expect(prompt).toContain("fluencyScore");
    });

    it("includes model sentence field", () => {
      const prompt = buildLanguageAgentPrompt({
        targetSkill: "es-ES",
        uiLanguage: "en-US",
        journalContent: "Hola mundo",
      });

      expect(prompt).toContain("modelSentence");
      expect(prompt).toContain("es-ES");
    });

    it("includes next challenge field", () => {
      const prompt = buildLanguageAgentPrompt({
        targetSkill: "fr-FR",
        uiLanguage: "fr-FR",
        journalContent: "Bonjour",
      });

      expect(prompt).toContain("nextChallenge");
    });

    it("outputs JSON only instruction", () => {
      const prompt = buildLanguageAgentPrompt({
        targetSkill: "pt-BR",
        uiLanguage: "pt-BR",
        journalContent: "Olá mundo",
      });

      expect(prompt).toContain("valid JSON only");
      expect(prompt).toContain("No markdown");
    });
  });

  describe("languageAgentLinguisticSchema", () => {
    it("validates correct linguistic scores", () => {
      const input = {
        grammarScore: 85,
        vocabularyScore: 72,
        fluencyScore: 68,
      };

      const result = languageAgentLinguisticSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects scores below 0", () => {
      const input = {
        grammarScore: -1,
        vocabularyScore: 50,
        fluencyScore: 50,
      };

      const result = languageAgentLinguisticSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects scores above 100", () => {
      const input = {
        grammarScore: 101,
        vocabularyScore: 50,
        fluencyScore: 50,
      };

      const result = languageAgentLinguisticSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("languageAgentErrorSchema", () => {
    it("validates correct error structure", () => {
      const input = {
        original: "I go to school yesterday",
        corrected: "I went to school yesterday",
        explanation: "Use past tense",
      };

      const result = languageAgentErrorSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects missing fields", () => {
      const input = {
        original: "I go to school",
        corrected: "I went to school",
      };

      const result = languageAgentErrorSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("languageAgentResponseSchema", () => {
    it("validates complete response", () => {
      const input = {
        agentType: "language-teacher",
        targetSkill: "en-US",
        linguistic: {
          grammarScore: 80,
          vocabularyScore: 75,
          fluencyScore: 70,
        },
        errors: [
          {
            original: "I am agree",
            corrected: "I agree",
            explanation: "Remove redundant 'am'",
          },
        ],
        modelSentence: "The weather is nice today.",
        nextChallenge: "Practice using past tense verbs",
      };

      const result = languageAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid agent type", () => {
      const input = {
        agentType: "behavioral-coach",
        targetSkill: "en-US",
        linguistic: {
          grammarScore: 80,
          vocabularyScore: 75,
          fluencyScore: 70,
        },
        errors: [],
        modelSentence: "Test",
        nextChallenge: "Test",
      };

      const result = languageAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("allows empty errors array", () => {
      const input = {
        agentType: "language-teacher",
        targetSkill: "en-US",
        linguistic: {
          grammarScore: 100,
          vocabularyScore: 100,
          fluencyScore: 100,
        },
        errors: [],
        modelSentence: "Perfect!",
        nextChallenge: "Keep it up!",
      };

      const result = languageAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
