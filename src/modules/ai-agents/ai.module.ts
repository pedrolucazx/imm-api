import type { DrizzleDb } from "../../core/database/connection.js";
import { createAiServiceFromDb } from "./ai.service.js";
import { createAiController } from "./ai.controller.js";

export function createAiModule(db: DrizzleDb) {
  const service = createAiServiceFromDb(db);
  return { controller: createAiController(service) };
}

export type AiModule = ReturnType<typeof createAiModule>;
