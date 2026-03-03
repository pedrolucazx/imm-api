import { hashPassword, comparePassword } from "../../shared/utils/password.js";
import { usersRepository } from "../users/users.repository.js";
import type { RegisterInput, LoginInput, AuthResponse } from "./auth.types.js";

export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await usersRepository.findByEmail(input.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await usersRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
      uiLang: input.ui_lang,
    });

    // Return user without password
    return {
      token: "", // Will be generated in controller
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ui_lang: user.uiLang,
      },
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user by email
    const user = await usersRepository.findByEmail(input.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Compare passwords
    const isValidPassword = await comparePassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    // Update ui_lang preference if provided
    let finalUser = user;
    if (input.ui_lang !== undefined) {
      finalUser = await usersRepository.update(user.id, { uiLang: input.ui_lang });
    }

    return {
      token: "", // Will be generated in controller
      user: {
        id: finalUser.id,
        email: finalUser.email,
        name: finalUser.name,
        ui_lang: finalUser.uiLang,
      },
    };
  }
}

export const authService = new AuthService();
