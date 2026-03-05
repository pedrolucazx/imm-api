import { eq } from "drizzle-orm";
import { hashPassword, comparePassword } from "../../shared/utils/password.js";
import { usersRepository } from "../users/users.repository.js";
import { userProfilesRepository } from "../users/user-profiles.repository.js";
import { getDb } from "../../core/database/connection.js";
import * as usersSchema from "../../core/database/schema/users.schema.js";
import * as userProfilesSchema from "../../core/database/schema/user-profiles.schema.js";
import { ConflictError, UnauthorizedError } from "../../shared/errors/index.js";
import type { RegisterInput, LoginInput, AuthResponse } from "./auth.types.js";

export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const passwordHash = await hashPassword(input.password);
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const [existingUser] = await tx
        .select()
        .from(usersSchema.users)
        .where(eq(usersSchema.users.email, input.email))
        .limit(1);

      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      try {
        const [user] = await tx
          .insert(usersSchema.users)
          .values({
            email: input.email,
            passwordHash,
            name: input.name,
          })
          .returning();

        const [profile] = await tx
          .insert(userProfilesSchema.userProfiles)
          .values({
            userId: user.id,
            uiLanguage: input.ui_lang || "pt-BR",
          })
          .returning();

        return { user, profile };
      } catch (error: unknown) {
        const dbError = error as { code?: string; message?: string };
        if (dbError.code === "23505" || dbError.message?.includes("duplicate key")) {
          throw new ConflictError("User with this email already exists");
        }
        throw error;
      }
    });

    return {
      token: "",
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        ui_lang: result.profile.uiLanguage,
      },
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await usersRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isValidPassword = await comparePassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid email or password");
    }

    let uiLang = "pt-BR";
    if (input.ui_lang !== undefined) {
      let profile = await userProfilesRepository.update(user.id, { uiLanguage: input.ui_lang });
      if (!profile) {
        profile = await userProfilesRepository.create({
          userId: user.id,
          uiLanguage: input.ui_lang,
        });
      }
      uiLang = profile.uiLanguage ?? "pt-BR";
    } else {
      let profile = await userProfilesRepository.findByUserId(user.id);
      if (!profile) {
        profile = await userProfilesRepository.create({
          userId: user.id,
          uiLanguage: "pt-BR",
        });
      }
      uiLang = profile.uiLanguage ?? "pt-BR";
    }

    return {
      token: "",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ui_lang: uiLang,
      },
    };
  }
}

export const authService = new AuthService();
