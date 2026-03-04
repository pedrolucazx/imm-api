import { hashPassword, comparePassword } from "../../shared/utils/password.js";
import { usersRepository } from "../users/users.repository.js";
import { userProfilesRepository } from "../users/user-profiles.repository.js";
import type { RegisterInput, LoginInput, AuthResponse } from "./auth.types.js";

export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existingUser = await usersRepository.findByEmail(input.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await usersRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    await userProfilesRepository.create({
      userId: user.id,
      uiLanguage: input.ui_lang || "pt-BR",
    });

    return {
      token: "",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ui_lang: input.ui_lang || "pt-BR",
      },
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await usersRepository.findByEmail(input.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isValidPassword = await comparePassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    let uiLang = "pt-BR";
    if (input.ui_lang !== undefined) {
      const profile = await userProfilesRepository.update(user.id, { uiLanguage: input.ui_lang });
      uiLang = profile.uiLanguage ?? "pt-BR";
    } else {
      const profile = await userProfilesRepository.findByUserId(user.id);
      if (profile) {
        uiLang = profile.uiLanguage ?? "pt-BR";
      }
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
