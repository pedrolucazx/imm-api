import type { DrizzleDb } from "../../core/database/connection.js";
import { createJournalRepository } from "./journal.repository.js";
import { createHabitsRepository } from "../habits/habits.repository.js";
import { createUserProfilesRepository } from "../users/user-profiles.repository.js";
import { createJournalService } from "./journal.service.js";
import { createJournalController } from "./journal.controller.js";

/**
 * Factory function to create a JournalModule with all dependencies.
 * @param db - The Drizzle database instance
 * @returns Module with controller instance
 */
export function createJournalModule(db: DrizzleDb) {
  const journalRepo = createJournalRepository(db);
  const habitsRepo = createHabitsRepository(db);
  const userProfilesRepo = createUserProfilesRepository(db);
  const service = createJournalService({ journalRepo, habitsRepo, userProfilesRepo });
  return { controller: createJournalController(service) };
}
