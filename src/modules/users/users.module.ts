import type { DrizzleDb } from "../../core/database/connection.js";
import { createUsersRepository } from "./users.repository.js";
import { createUserProfilesRepository } from "./user-profiles.repository.js";
import { createUsersService } from "./users.service.js";
import { createUsersController } from "./users.controller.js";

export function createUsersModule(db: DrizzleDb) {
  const usersRepo = createUsersRepository(db);
  const userProfilesRepo = createUserProfilesRepository(db);
  const service = createUsersService({ usersRepo, userProfilesRepo, db });
  return { controller: createUsersController(service) };
}
