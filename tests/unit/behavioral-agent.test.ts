import {
  buildBehavioralAgentPrompt,
  behavioralAgentResponseSchema,
  behavioralAgentBehavioralSchema,
} from "@/modules/ai-agents/agent-behavioral.js";

describe("Behavioral Coach Agent", () => {
  describe("buildBehavioralAgentPrompt", () => {
    it("builds prompt with target skill and journal content", () => {
      const input = {
        targetSkill: "fitness",
        uiLanguage: "pt-BR",
        journalContent: "Today I did a 30 minute workout and felt great!",
        habitName: "Morning Exercise",
        targetFrequency: "Daily",
      };

      const prompt = buildBehavioralAgentPrompt(input);

      expect(prompt).toContain("Behavioral Coach AI agent");
      expect(prompt).toContain("fitness");
      expect(prompt).toContain("pt-BR");
      expect(prompt).toContain("Today I did a 30 minute workout and felt great!");
      expect(prompt).toContain("Morning Exercise");
      expect(prompt).toContain("Daily");
      expect(prompt).toContain("moodDetected");
      expect(prompt).toContain("energyLevel");
      expect(prompt).toContain("habitAlignmentScore");
    });

    it("works without optional habit fields", () => {
      const prompt = buildBehavioralAgentPrompt({
        targetSkill: "mindfulness",
        uiLanguage: "en-US",
        journalContent: "I meditated for 10 minutes today.",
      });

      expect(prompt).toContain("mindfulness");
      expect(prompt).toContain("insights");
      expect(prompt).toContain("actionSuggestion");
    });

    it("includes behavioral analysis fields", () => {
      const prompt = buildBehavioralAgentPrompt({
        targetSkill: "general",
        uiLanguage: "es-ES",
        journalContent: "Today was a good day",
      });

      expect(prompt).toContain("motivated");
      expect(prompt).toContain("fatigued");
      expect(prompt).toContain("neutral");
      expect(prompt).toContain("stressed");
      expect(prompt).toContain("relaxed");
      expect(prompt).toContain("anxious");
      expect(prompt).toContain("high");
      expect(prompt).toContain("medium");
      expect(prompt).toContain("low");
    });

    it("outputs JSON only instruction", () => {
      const prompt = buildBehavioralAgentPrompt({
        targetSkill: "fitness",
        uiLanguage: "pt-BR",
        journalContent: "Workout done",
      });

      expect(prompt).toContain("valid JSON only");
      expect(prompt).toContain("No markdown");
    });
  });

  describe("behavioralAgentBehavioralSchema", () => {
    it("validates correct mood and energy", () => {
      const input = {
        moodDetected: "motivated" as const,
        energyLevel: "high" as const,
      };

      const result = behavioralAgentBehavioralSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("validates fatigued with low energy", () => {
      const input = {
        moodDetected: "fatigued" as const,
        energyLevel: "low" as const,
      };

      const result = behavioralAgentBehavioralSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("validates relaxed with medium energy", () => {
      const input = {
        moodDetected: "relaxed" as const,
        energyLevel: "medium" as const,
      };

      const result = behavioralAgentBehavioralSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid mood", () => {
      const input = {
        moodDetected: "happy",
        energyLevel: "high",
      };

      const result = behavioralAgentBehavioralSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects invalid energy level", () => {
      const input = {
        moodDetected: "neutral",
        energyLevel: "very-high",
      };

      const result = behavioralAgentBehavioralSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("behavioralAgentResponseSchema", () => {
    it("validates complete response", () => {
      const input = {
        agentType: "behavioral-coach",
        targetSkill: "fitness",
        behavioral: {
          moodDetected: "motivated" as const,
          energyLevel: "high" as const,
        },
        habitAlignmentScore: 85,
        insights: [
          "Great progress on consistency",
          "Energy levels are improving",
          "Keep up the good work",
        ],
        actionSuggestion: "Try adding a 5-minute warm-up before your main workout",
      };

      const result = behavioralAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid agent type", () => {
      const input = {
        agentType: "language-teacher",
        targetSkill: "fitness",
        behavioral: {
          moodDetected: "neutral" as const,
          energyLevel: "medium" as const,
        },
        habitAlignmentScore: 70,
        insights: ["Test"],
        actionSuggestion: "Test",
      };

      const result = behavioralAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("allows single insight", () => {
      const input = {
        agentType: "behavioral-coach",
        targetSkill: "mindfulness",
        behavioral: {
          moodDetected: "relaxed" as const,
          energyLevel: "medium" as const,
        },
        habitAlignmentScore: 90,
        insights: ["Excellent meditation session"],
        actionSuggestion: "Continue your current practice",
      };

      const result = behavioralAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects habitAlignmentScore below 0", () => {
      const input = {
        agentType: "behavioral-coach",
        targetSkill: "general",
        behavioral: {
          moodDetected: "neutral" as const,
          energyLevel: "low" as const,
        },
        habitAlignmentScore: -1,
        insights: [],
        actionSuggestion: "Test",
      };

      const result = behavioralAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects habitAlignmentScore above 100", () => {
      const input = {
        agentType: "behavioral-coach",
        targetSkill: "general",
        behavioral: {
          moodDetected: "neutral" as const,
          energyLevel: "low" as const,
        },
        habitAlignmentScore: 101,
        insights: [],
        actionSuggestion: "Test",
      };

      const result = behavioralAgentResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
