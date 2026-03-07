import type { DrizzleDb } from "../../core/database/connection.js";
import { createProfileRepository } from "./profile.repository.js";
import { createProfileService } from "./profile.service.js";
import { createProfileController } from "./profile.controller.js";

export function createProfileModule(db: DrizzleDb) {
  const profileRepo = createProfileRepository(db);
  const service = createProfileService({ profileRepo });
  return { controller: createProfileController(service) };
}
