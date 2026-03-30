import type { DrizzleDb } from "../../core/database/connection.js";
import { createUsersRepository } from "./users.repository.js";
import { createUserProfilesRepository } from "./user-profiles.repository.js";
import { createOnboardingRepository } from "./onboarding.repository.js";
import { createUsersService } from "./users.service.js";
import { createOnboardingService } from "./onboarding.service.js";
import { createUsersController } from "./users.controller.js";
import { createOnboardingController } from "./onboarding.controller.js";

export function createUsersModule(db: DrizzleDb) {
  const usersRepo = createUsersRepository(db);
  const userProfilesRepo = createUserProfilesRepository(db);
  const onboardingRepo = createOnboardingRepository(db);
  const service = createUsersService({ usersRepo, userProfilesRepo, db });
  const onboardingService = createOnboardingService({ repo: onboardingRepo });
  return {
    controller: createUsersController(service),
    onboardingController: createOnboardingController(onboardingService),
  };
}
