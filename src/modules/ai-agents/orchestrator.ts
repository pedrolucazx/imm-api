import type { HabitMode } from "../../shared/schemas/habit-mode.js";

export interface Agent {
  type: "language-teacher" | "behavioral-coach";
  name: string;
  description: string;
}

export const AGENTS: Record<string, Agent> = {
  "language-teacher": {
    type: "language-teacher",
    name: "Language Teacher",
    description: "AI agent specialized in language learning and conversation practice",
  },
  "behavioral-coach": {
    type: "behavioral-coach",
    name: "Behavioral Coach",
    description: "AI agent specialized in behavior change and habit coaching",
  },
};

export type OrchestratorDeps = {
  deriveHabitMode: (targetSkill: string) => HabitMode;
};

export function createOrchestrator({ deriveHabitMode }: OrchestratorDeps) {
  return {
    /**
     * Routes to the appropriate agent based on habit mode.
     * @param targetSkill - The target skill from the habit (e.g., "en-US", "fitness")
     * @returns The appropriate agent for the given habit mode
     */
    route(targetSkill: string): Agent {
      const habitMode = deriveHabitMode(targetSkill);
      return habitMode === "skill-building"
        ? AGENTS["language-teacher"]
        : AGENTS["behavioral-coach"];
    },
  };
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
