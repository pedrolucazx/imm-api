import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword } from "../../shared/utils/password.js";
import { hashToken } from "../../shared/utils/token.js";
import type { DrizzleDb } from "../../core/database/connection.js";
import * as usersSchema from "../../core/database/schema/users.schema.js";
import * as userProfilesSchema from "../../core/database/schema/user-profiles.schema.js";
import type { UsersRepository } from "../users/users.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import type { RefreshTokensRepository } from "./refresh-tokens.repository.js";
import { ConflictError, UnauthorizedError } from "../../shared/errors/index.js";
import {
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES_MS,
  DEFAULT_UI_LANGUAGE,
  PG_DUPLICATE_KEY_CODE,
} from "../../shared/constants.js";
import type { RegisterInput, LoginInput, AuthResponse, JwtSignFn } from "./auth.types.js";

type AuthServiceDeps = {
  db: DrizzleDb;
  usersRepo: UsersRepository;
  profilesRepo: UserProfilesRepository;
  refreshTokensRepo: RefreshTokensRepository;
};

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

export function createAuthService({
  db,
  usersRepo,
  profilesRepo,
  refreshTokensRepo,
}: AuthServiceDeps) {
  async function persistRefreshToken(userId: string, token: string) {
    await refreshTokensRepo.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    });
  }

  return {
    async register(input: RegisterInput, jwt: JwtSignFn): Promise<AuthResponse> {
      const passwordHash = await hashPassword(input.password);

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
            .values({ email: input.email, passwordHash, name: input.name })
            .returning();

          const [profile] = await tx
            .insert(userProfilesSchema.userProfiles)
            .values({ userId: user.id, uiLanguage: input.ui_lang || DEFAULT_UI_LANGUAGE })
            .returning();

          return { user, profile };
        } catch (error: unknown) {
          const dbError = error as { code?: string; message?: string };
          if (
            dbError.code === PG_DUPLICATE_KEY_CODE ||
            dbError.message?.includes("duplicate key")
          ) {
            throw new ConflictError("User with this email already exists");
          }
          throw error;
        }
      });

      const { accessToken, refreshToken } = generateTokens(jwt, {
        id: result.user.id,
        email: result.user.email,
      });

      await persistRefreshToken(result.user.id, refreshToken);

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
    },

    async login(input: LoginInput, jwt: JwtSignFn): Promise<AuthResponse> {
      const user = await usersRepo.findByEmail(input.email);
      if (!user) throw new UnauthorizedError("Invalid email or password");

      const isValidPassword = await comparePassword(input.password, user.passwordHash);
      if (!isValidPassword) throw new UnauthorizedError("Invalid email or password");

      let uiLang = DEFAULT_UI_LANGUAGE;
      if (input.ui_lang !== undefined) {
        let profile = await profilesRepo.update(user.id, { uiLanguage: input.ui_lang });
        if (!profile) {
          profile = await profilesRepo.create({ userId: user.id, uiLanguage: input.ui_lang });
        }
        uiLang = profile.uiLanguage ?? DEFAULT_UI_LANGUAGE;
      } else {
        let profile = await profilesRepo.findByUserId(user.id);
        if (!profile) {
          profile = await profilesRepo.create({ userId: user.id, uiLanguage: DEFAULT_UI_LANGUAGE });
        }
        uiLang = profile.uiLanguage ?? DEFAULT_UI_LANGUAGE;
      }

      const { accessToken, refreshToken } = generateTokens(jwt, { id: user.id, email: user.email });

      await persistRefreshToken(user.id, refreshToken);

      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, ui_lang: uiLang },
      };
    },

    async refresh(refreshToken: string, jwt: JwtSignFn): Promise<AuthResponse> {
      const tokenHash = hashToken(refreshToken);
      const token = await refreshTokensRepo.consumeActiveByHash(tokenHash);

      if (!token) throw new UnauthorizedError("Invalid or expired refresh token");
      if (token.expiresAt < new Date()) throw new UnauthorizedError("Refresh token expired");

      const user = await usersRepo.findById(token.userId);
      if (!user) throw new UnauthorizedError("User not found");

      const profile = await profilesRepo.findByUserId(user.id);
      const newTokens = generateTokens(jwt, { id: user.id, email: user.email });

      await persistRefreshToken(user.id, newTokens.refreshToken);

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          ui_lang: profile?.uiLanguage ?? DEFAULT_UI_LANGUAGE,
        },
      };
    },

    async logout(refreshToken: string): Promise<void> {
      await refreshTokensRepo.revoke(hashToken(refreshToken));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
