import type { DrizzleDb } from "../../core/database/connection.js";
import { createJournalRepository } from "./journal.repository.js";
import { createHabitsRepository } from "../habits/habits.repository.js";
import { createUserProfilesRepository } from "../users/user-profiles.repository.js";
import { createJournalService } from "./journal.service.js";
import { createJournalController } from "./journal.controller.js";
import { getTranscriptionProvider } from "../../core/ai/transcription.factory.js";
import { getStorageProvider } from "../../core/storage/storage.factory.js";

export function createJournalModule(db: DrizzleDb) {
  const journalRepo = createJournalRepository(db);
  const habitsRepo = createHabitsRepository(db);
  const userProfilesRepo = createUserProfilesRepository(db);
  const transcription = getTranscriptionProvider();
  const storage = getStorageProvider();
  const service = createJournalService({
    journalRepo,
    habitsRepo,
    userProfilesRepo,
    transcription,
    storage,
  });
  return { controller: createJournalController(service) };
}
