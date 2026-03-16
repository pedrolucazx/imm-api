import { createOrchestrator } from "@/modules/ai-agents/orchestrator.js";

describe("Orchestrator", () => {
  describe("route", () => {
    it("routes to language-teacher for skill-building locales", () => {
      const mockDeriveHabitMode = jest.fn((targetSkill: string) => {
        const skillBuildingLocales = ["en-US", "es-ES", "fr-FR", "pt-BR"];
        return skillBuildingLocales.includes(targetSkill) ? "skill-building" : "tracking-coached";
      });

      const orchestrator = createOrchestrator({ deriveHabitMode: mockDeriveHabitMode });

      expect(orchestrator.route("en-US").type).toBe("language-teacher");
      expect(orchestrator.route("es-ES").type).toBe("language-teacher");
      expect(orchestrator.route("fr-FR").type).toBe("language-teacher");
      expect(orchestrator.route("pt-BR").type).toBe("language-teacher");
      expect(mockDeriveHabitMode).toHaveBeenCalledTimes(4);
    });

    it("routes to behavioral-coach for non-language skills", () => {
      const mockDeriveHabitMode = jest.fn((targetSkill: string) => {
        const skillBuildingLocales = ["en-US", "es-ES", "fr-FR", "pt-BR"];
        return skillBuildingLocales.includes(targetSkill) ? "skill-building" : "tracking-coached";
      });

      const orchestrator = createOrchestrator({ deriveHabitMode: mockDeriveHabitMode });

      expect(orchestrator.route("fitness").type).toBe("behavioral-coach");
      expect(orchestrator.route("mindfulness").type).toBe("behavioral-coach");
      expect(orchestrator.route("general").type).toBe("behavioral-coach");
      expect(orchestrator.route("cooking").type).toBe("behavioral-coach");
      expect(mockDeriveHabitMode).toHaveBeenCalledTimes(4);
    });

    it("returns correct agent structure", () => {
      const orchestrator = createOrchestrator({
        deriveHabitMode: () => "skill-building",
      });

      const agent = orchestrator.route("en-US");

      expect(agent).toHaveProperty("type");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("description");
      expect(agent.type).toBe("language-teacher");
    });
  });
});
