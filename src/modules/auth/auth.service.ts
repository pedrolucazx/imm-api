import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword } from "../../shared/utils/password.js";
import { usersRepository } from "../users/users.repository.js";
import { userProfilesRepository } from "../users/user-profiles.repository.js";
import { getDb } from "../../core/database/connection.js";
import * as usersSchema from "../../core/database/schema/users.schema.js";
import * as userProfilesSchema from "../../core/database/schema/user-profiles.schema.js";
import { refreshTokensRepository } from "./refresh-tokens.repository.js";
import { ConflictError, UnauthorizedError } from "../../shared/errors/index.js";
import {
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES_MS,
} from "../../shared/constants.js";
import type { RegisterInput, LoginInput, AuthResponse } from "./auth.types.js";

type JwtSignFn = (payload: object, options?: { expiresIn?: string | number }) => string;

/**
 * Hashes a token using SHA256.
 * @param token - The token to hash
 * @returns The hashed token
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates access and refresh tokens for a user.
 * @param jwt - The JWT signing function
 * @param user - The user data (id, email)
 * @returns Object containing accessToken and refreshToken
 */
function generateTokens(
  jwt: JwtSignFn,
  user: { id: string; email: string }
): { accessToken: string; refreshToken: string } {
  const nonce = randomBytes(16).toString("hex");
  const accessToken = jwt({ id: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_EXPIRES });
  const refreshToken = jwt(
    { id: user.id, type: "refresh", nonce },
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );

  return { accessToken, refreshToken };
}

/**
 * Service for handling authentication operations.
 */
export class AuthService {
  /**
   * Registers a new user in the system.
   * @param input - Registration input (email, password, name, ui_lang)
   * @param jwt - The JWT signing function
   * @returns Authentication response with tokens and user data
   */
  async register(input: RegisterInput, jwt: JwtSignFn): Promise<AuthResponse> {
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

    const { accessToken, refreshToken } = generateTokens(jwt, {
      id: result.user.id,
      email: result.user.email,
    });

    await refreshTokensRepository.create({
      userId: result.user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        ui_lang: result.profile.uiLanguage,
      },
    };
  }

  /**
   * Authenticates a user with email and password.
   * @param input - Login input (email, password, ui_lang)
   * @param jwt - The JWT signing function
   * @returns Authentication response with tokens and user data
   */
  async login(input: LoginInput, jwt: JwtSignFn): Promise<AuthResponse> {
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

    const { accessToken, refreshToken } = generateTokens(jwt, {
      id: user.id,
      email: user.email,
    });

    await refreshTokensRepository.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ui_lang: uiLang,
      },
    };
  }

  /**
   * Refreshes the access token using a valid refresh token.
   * Implements token rotation - generates new tokens and revokes the old one.
   * @param refreshToken - The refresh token from cookie
   * @param jwt - The JWT signing function
   * @returns New authentication response with fresh tokens
   */
  async refresh(refreshToken: string, jwt: JwtSignFn): Promise<AuthResponse> {
    const tokenHash = hashToken(refreshToken);
    const token = await refreshTokensRepository.consumeActiveByHash(tokenHash);

    if (!token) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedError("Refresh token expired");
    }

    const user = await usersRepository.findById(token.userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    const profile = await userProfilesRepository.findByUserId(user.id);

    const newTokens = generateTokens(jwt, { id: user.id, email: user.email });

    await refreshTokensRepository.create({
      userId: user.id,
      tokenHash: hashToken(newTokens.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    });

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ui_lang: profile?.uiLanguage ?? "pt-BR",
      },
    };
  }

  /**
   * Logs out a user by revoking their refresh token.
   * @param refreshToken - The refresh token to revoke
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await refreshTokensRepository.revoke(tokenHash);
  }
}

export const authService = new AuthService();
