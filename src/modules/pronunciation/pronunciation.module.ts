import type { DrizzleDb } from "../../core/database/connection.js";
import { createPronunciationRepository } from "./pronunciation.repository.js";
import { createHabitsRepository } from "../habits/habits.repository.js";
import { createPronunciationService } from "./pronunciation.service.js";
import { createPronunciationController } from "./pronunciation.controller.js";

export function createPronunciationModule(db: DrizzleDb) {
  const pronunciationRepo = createPronunciationRepository(db);
  const habitsRepo = createHabitsRepository(db);
  const service = createPronunciationService({ pronunciationRepo, habitsRepo });
  return { controller: createPronunciationController(service) };
}
