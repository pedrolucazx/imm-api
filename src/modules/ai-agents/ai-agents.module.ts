import { deriveHabitMode, type TargetSkill } from "../../shared/schemas/habit-mode.js";
import { createOrchestrator } from "./orchestrator.js";

/**
 * Factory function to create the AI agents module with all dependencies.
 * @returns Module with orchestrator instance
 */
export function createAiAgentsModule() {
  return {
    orchestrator: createOrchestrator({
      deriveHabitMode: (targetSkill: string) => deriveHabitMode(targetSkill as TargetSkill),
    }),
  };
}

/**
 * Type representing the AI agents module instance.
 */
export type AiAgentsModule = ReturnType<typeof createAiAgentsModule>;
