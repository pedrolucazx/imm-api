import { deriveHabitMode, type TargetSkill } from "../../shared/schemas/habit-mode.js";
import { createOrchestrator } from "./orchestrator.js";

export function createAiAgentsModule() {
  return {
    orchestrator: createOrchestrator({
      deriveHabitMode: (targetSkill: string) => deriveHabitMode(targetSkill as TargetSkill),
    }),
  };
}

export type AiAgentsModule = ReturnType<typeof createAiAgentsModule>;
