import type { DrizzleDb } from "../../core/database/connection.js";
import { createHabitsRepository } from "./habits.repository.js";
import { createHabitLogsRepository } from "./habit-logs.repository.js";
import { createHabitsService } from "./habits.service.js";
import { createHabitsController } from "./habits.controller.js";

export function createHabitsModule(db: DrizzleDb) {
  const habitsRepo = createHabitsRepository(db);
  const habitLogsRepo = createHabitLogsRepository(db);
  const service = createHabitsService({ habitsRepo, habitLogsRepo });
  return { controller: createHabitsController(service) };
}
