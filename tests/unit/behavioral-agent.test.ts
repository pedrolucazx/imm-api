import {
  behavioralAgentResponseSchema,
  behavioralAgentBehavioralSchema,
} from "@/modules/ai-agents/behavioral-agent.js";

describe("Behavioral Coach Agent", () => {
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
