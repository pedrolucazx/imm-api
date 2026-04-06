import type { DrizzleDb } from "../../core/database/connection.js";
import { createPronunciationRepository } from "./pronunciation.repository.js";
import { createHabitsRepository } from "../habits/habits.repository.js";
import { createPronunciationService } from "./pronunciation.service.js";
import { createPronunciationController } from "./pronunciation.controller.js";
import { getTranscriptionProvider } from "../../core/ai/transcription.factory.js";
import { getStorageProvider } from "../../core/storage/storage.factory.js";

export function createPronunciationModule(db: DrizzleDb) {
  const pronunciationRepo = createPronunciationRepository(db);
  const habitsRepo = createHabitsRepository(db);
  const transcription = getTranscriptionProvider();
  const storage = getStorageProvider();
  const service = createPronunciationService({
    pronunciationRepo,
    habitsRepo,
    transcription,
    storage,
  });
  return { controller: createPronunciationController(service, storage) };
}
