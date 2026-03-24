import { eq, and, isNull, gt, lt } from "drizzle-orm";
import type { DrizzleDb } from "../../core/database/connection.js";
import {
  emailVerificationTokens,
  type NewEmailVerificationToken,
  type EmailVerificationToken,
} from "../../core/database/schema/email-verification-tokens.schema.js";

export function createEmailVerificationTokensRepository(db: DrizzleDb) {
  return {
    async create(input: Omit<NewEmailVerificationToken, "id">): Promise<EmailVerificationToken> {
      const [token] = await db.insert(emailVerificationTokens).values(input).returning();
      return token;
    },

    async findByHash(tokenHash: string): Promise<EmailVerificationToken | undefined> {
      const [token] = await db
        .select()
        .from(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, tokenHash),
            isNull(emailVerificationTokens.usedAt),
            gt(emailVerificationTokens.expiresAt, new Date())
          )
        )
        .limit(1);
      return token;
    },

    async markAsUsed(tokenHash: string): Promise<void> {
      await db
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, tokenHash),
            isNull(emailVerificationTokens.usedAt)
          )
        );
    },

    async invalidateUserTokens(userId: string): Promise<void> {
      await db
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt))
        );
    },

    async deleteExpired(): Promise<void> {
      await db
        .delete(emailVerificationTokens)
        .where(lt(emailVerificationTokens.expiresAt, new Date()));
    },
  };
}

export type EmailVerificationTokensRepository = ReturnType<
  typeof createEmailVerificationTokensRepository
>;
