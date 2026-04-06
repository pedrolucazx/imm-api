import type { DrizzleDb } from "../../core/database/connection.js";
import { createHabitsRepository } from "./habits.repository.js";
import { createHabitLogsRepository } from "./habit-logs.repository.js";
import { createUserProfilesRepository } from "../users/user-profiles.repository.js";
import { createHabitsService } from "./habits.service.js";
import { createHabitsController } from "./habits.controller.js";
import { getTextAIProvider } from "../../core/ai/ai.factory.js";

export function createHabitsModule(db: DrizzleDb) {
  const habitsRepo = createHabitsRepository(db);
  const habitLogsRepo = createHabitLogsRepository(db);
  const userProfilesRepo = createUserProfilesRepository(db);
  const textAI = getTextAIProvider();
  const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo, textAI });
  return { controller: createHabitsController(service) };
}
