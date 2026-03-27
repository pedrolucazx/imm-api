import { eq, and, isNull, lt, gt } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import {
  passwordResetTokens,
  type NewPasswordResetToken,
  type PasswordResetToken,
} from "../../core/database/schema/password-reset-tokens.schema.js";

export function createPasswordResetTokensRepository(db: DrizzleDb) {
  return {
    async create(
      input: Omit<NewPasswordResetToken, "id">,
      tx?: DbClient
    ): Promise<PasswordResetToken> {
      const client = tx ?? db;
      const [token] = await client.insert(passwordResetTokens).values(input).returning();
      return token;
    },

    async findByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
      const [token] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);
      return token;
    },

    async markAsUsed(tokenHash: string, tx?: DbClient): Promise<void> {
      const client = tx ?? db;
      await client
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt))
        );
    },

    async invalidateUserTokens(userId: string, tx?: DbClient): Promise<void> {
      const client = tx ?? db;
      await client
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    },

    async deleteExpired(): Promise<void> {
      await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
    },
  };
}

export type PasswordResetTokensRepository = ReturnType<typeof createPasswordResetTokensRepository>;
