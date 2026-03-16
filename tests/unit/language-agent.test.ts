import {
  languageAgentResponseSchema,
  languageAgentLinguisticSchema,
  languageAgentErrorSchema,
} from "@/modules/ai-agents/language-agent.js";

describe("Language Agent", () => {
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
