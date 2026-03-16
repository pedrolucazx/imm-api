import type { HabitMode } from "../../shared/schemas/habit-mode.js";

export interface Agent {
  type: "language-teacher" | "behavioral-coach";
  name: string;
  description: string;
}

const AGENTS: Record<HabitMode, Agent> = {
  "skill-building": {
    type: "language-teacher",
    name: "Language Teacher",
    description: "AI agent specialized in language learning and conversation practice",
  },
  "tracking-coached": {
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
    route(targetSkill: string): Agent {
      return AGENTS[deriveHabitMode(targetSkill)];
    },
  };
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
