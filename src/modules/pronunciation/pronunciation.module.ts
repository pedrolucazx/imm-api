import type { DrizzleDb } from "../../core/database/connection.js";
import { createPronunciationRepository } from "./pronunciation.repository.js";
import { createHabitsRepository } from "../habits/habits.repository.js";
import { createPronunciationService } from "./pronunciation.service.js";
import { createPronunciationController } from "./pronunciation.controller.js";
import { getTranscriptionProvider } from "../../core/ai/transcription.factory.js";

export function createPronunciationModule(db: DrizzleDb) {
  const pronunciationRepo = createPronunciationRepository(db);
  const habitsRepo = createHabitsRepository(db);
  const transcription = getTranscriptionProvider();
  const service = createPronunciationService({
    pronunciationRepo,
    habitsRepo,
    transcription,
  });
  return { controller: createPronunciationController(service) };
}
