import { createOrchestrator, AGENTS } from "@/modules/ai-agents/orchestrator.js";

describe("Orchestrator", () => {
  describe("route", () => {
    it("routes to language-teacher for skill-building locales", () => {
      const mockDeriveHabitMode = jest.fn((targetSkill: string) => {
        const skillBuildingLocales = ["en-US", "es-ES", "fr-FR", "pt-BR"];
        return skillBuildingLocales.includes(targetSkill) ? "skill-building" : "tracking-coached";
      });

      const orchestrator = createOrchestrator({ deriveHabitMode: mockDeriveHabitMode });

      expect(orchestrator.route("en-US")).toEqual(AGENTS["language-teacher"]);
      expect(orchestrator.route("es-ES")).toEqual(AGENTS["language-teacher"]);
      expect(orchestrator.route("fr-FR")).toEqual(AGENTS["language-teacher"]);
      expect(orchestrator.route("pt-BR")).toEqual(AGENTS["language-teacher"]);
      expect(mockDeriveHabitMode).toHaveBeenCalledTimes(4);
    });

    it("routes to behavioral-coach for non-language skills", () => {
      const mockDeriveHabitMode = jest.fn((targetSkill: string) => {
        const skillBuildingLocales = ["en-US", "es-ES", "fr-FR", "pt-BR"];
        return skillBuildingLocales.includes(targetSkill) ? "skill-building" : "tracking-coached";
      });

      const orchestrator = createOrchestrator({ deriveHabitMode: mockDeriveHabitMode });

      expect(orchestrator.route("fitness")).toEqual(AGENTS["behavioral-coach"]);
      expect(orchestrator.route("mindfulness")).toEqual(AGENTS["behavioral-coach"]);
      expect(orchestrator.route("general")).toEqual(AGENTS["behavioral-coach"]);
      expect(orchestrator.route("cooking")).toEqual(AGENTS["behavioral-coach"]);
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

  describe("AGENTS constant", () => {
    it("contains both available agents", () => {
      expect(AGENTS).toHaveProperty("language-teacher");
      expect(AGENTS).toHaveProperty("behavioral-coach");
    });

    it("has correct agent types", () => {
      expect(AGENTS["language-teacher"].type).toBe("language-teacher");
      expect(AGENTS["behavioral-coach"].type).toBe("behavioral-coach");
    });
  });
});
