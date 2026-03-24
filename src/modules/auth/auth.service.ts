import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { hashPassword, comparePassword } from "../../shared/utils/password.js";
import { hashToken, generateTokens } from "../../shared/utils/token.js";
import type { DrizzleDb } from "../../core/database/connection.js";
import * as usersSchema from "../../core/database/schema/users.schema.js";
import * as userProfilesSchema from "../../core/database/schema/user-profiles.schema.js";
import type { UsersRepository } from "../users/users.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import type { RefreshTokensRepository } from "./refresh-tokens.repository.js";
import type { EmailVerificationTokensRepository } from "./email-verification-tokens.repository.js";
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from "../../shared/errors/index.js";
import {
  REFRESH_TOKEN_EXPIRES_MS,
  DEFAULT_UI_LANGUAGE,
  PG_DUPLICATE_KEY_CODE,
  EMAIL_VERIFICATION_TOKEN_EXPIRES_MS,
} from "../../shared/constants.js";
import type {
  RegisterInput,
  LoginInput,
  VerifyEmailInput,
  ResendVerificationInput,
  RegisterResponse,
  AuthResponse,
  JwtSignFn,
} from "./auth.types.js";
import { sendVerificationEmail } from "./email.service.js";
import { env } from "../../core/config/env.js";

type AuthServiceDeps = {
  db: DrizzleDb;
  usersRepo: UsersRepository;
  profilesRepo: UserProfilesRepository;
  refreshTokensRepo: RefreshTokensRepository;
  emailVerificationTokensRepo: EmailVerificationTokensRepository;
};

export function createAuthService({
  db,
  usersRepo,
  profilesRepo,
  refreshTokensRepo,
  emailVerificationTokensRepo,
}: AuthServiceDeps) {
  async function persistRefreshToken(userId: string, token: string) {
    await refreshTokensRepo.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    });
  }

  return {
    async register(input: RegisterInput): Promise<RegisterResponse> {
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

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      await emailVerificationTokensRepo.create({
        userId: result.user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRES_MS),
      });

      const verificationLink = `${env.APP_URL}/verify-email?token=${rawToken}`;

      await sendVerificationEmail({
        to: result.user.email,
        verificationLink,
        name: result.user.name,
      });

      return { message: "Verification email sent" };
    },

    async login(input: LoginInput, jwt: JwtSignFn): Promise<AuthResponse> {
      const user = await usersRepo.findByEmail(input.email);
      if (!user) throw new UnauthorizedError("Invalid email or password");

      const isValidPassword = await comparePassword(input.password, user.passwordHash);
      if (!isValidPassword) throw new UnauthorizedError("Invalid email or password");

      if (!user.emailVerifiedAt) {
        throw new ForbiddenError("EMAIL_NOT_VERIFIED");
      }

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

    async verifyEmail(input: VerifyEmailInput, jwt: JwtSignFn): Promise<AuthResponse> {
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      const verificationToken = await emailVerificationTokensRepo.findByHash(tokenHash);

      if (!verificationToken) {
        throw new BadRequestError("Invalid or expired verification token");
      }

      const user = await usersRepo.findById(verificationToken.userId);
      if (!user) throw new BadRequestError("User not found");

      if (user.emailVerifiedAt) {
        await emailVerificationTokensRepo.markAsUsed(tokenHash);
        throw new BadRequestError("Email already verified");
      }

      await emailVerificationTokensRepo.markAsUsed(tokenHash);
      await usersRepo.markEmailVerified(user.id);

      const profile = await profilesRepo.findByUserId(user.id);
      const { accessToken, refreshToken } = generateTokens(jwt, { id: user.id, email: user.email });

      await persistRefreshToken(user.id, refreshToken);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          ui_lang: profile?.uiLanguage ?? DEFAULT_UI_LANGUAGE,
        },
      };
    },

    async resendVerification(input: ResendVerificationInput): Promise<void> {
      const user = await usersRepo.findByEmail(input.email);
      if (!user) return;

      if (user.emailVerifiedAt) return;

      await emailVerificationTokensRepo.invalidateUserTokens(user.id);

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      await emailVerificationTokensRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRES_MS),
      });

      const verificationLink = `${env.APP_URL}/verify-email?token=${rawToken}`;

      await sendVerificationEmail({
        to: user.email,
        verificationLink,
        name: user.name,
      });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
