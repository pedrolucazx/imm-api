import type { DrizzleDb } from "@/core/database/connection.js";
import { createConsentsRepository } from "./consents.repository.js";
import { createConsentsService } from "./consents.service.js";
import { createConsentsController } from "./consents.controller.js";

/**
 * Creates the consents module with dependency injection.
 * @param db - Drizzle database instance
 * @returns Module with controller, service, and repository instances
 */
export function createConsentsModule(db: DrizzleDb) {
  const repository = createConsentsRepository(db);
  const service = createConsentsService(repository);
  const controller = createConsentsController(service);

  return { controller, service, repository };
}
