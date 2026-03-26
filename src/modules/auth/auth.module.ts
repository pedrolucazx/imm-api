import type { DrizzleDb } from "../../core/database/connection.js";
import { createUsersRepository } from "../users/users.repository.js";
import { createUserProfilesRepository } from "../users/user-profiles.repository.js";
import { createRefreshTokensRepository } from "./refresh-tokens.repository.js";
import { createEmailVerificationTokensRepository } from "./email-verification-tokens.repository.js";
import { createPasswordResetTokensRepository } from "./password-reset-tokens.repository.js";
import { createAuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

export function createAuthModule(db: DrizzleDb) {
  const usersRepo = createUsersRepository(db);
  const profilesRepo = createUserProfilesRepository(db);
  const refreshTokensRepo = createRefreshTokensRepository(db);
  const emailVerificationTokensRepo = createEmailVerificationTokensRepository(db);
  const passwordResetTokensRepo = createPasswordResetTokensRepository(db);
  const service = createAuthService({
    db,
    usersRepo,
    profilesRepo,
    refreshTokensRepo,
    emailVerificationTokensRepo,
    passwordResetTokensRepo,
  });
  return { controller: createAuthController(service) };
}
