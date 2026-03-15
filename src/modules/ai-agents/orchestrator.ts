import type { HabitMode } from "../../shared/schemas/habit-mode.js";

/**
 * Represents an AI agent with its metadata.
 */
export interface Agent {
  type: "language-teacher" | "behavioral-coach";
  name: string;
  description: string;
}

/**
 * Registry of available AI agents.
 */
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

/**
 * Dependencies required by the orchestrator.
 */
export type OrchestratorDeps = {
  deriveHabitMode: (targetSkill: string) => HabitMode;
};

/**
 * Factory function to create an orchestrator instance.
 * @param deps - The dependencies including deriveHabitMode function
 * @returns Orchestrator with route method
 */
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

/**
 * Type representing the orchestrator instance.
 */
export type Orchestrator = ReturnType<typeof createOrchestrator>;
