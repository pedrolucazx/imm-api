import { eq, and, isNull, lt } from "drizzle-orm";
import type { DrizzleDb } from "../../core/database/connection.js";
import {
  refreshTokens,
  type NewRefreshToken,
  type RefreshToken,
} from "../../core/database/schema/refresh-tokens.schema.js";

export function createRefreshTokensRepository(db: DrizzleDb) {
  return {
    async create(input: Omit<NewRefreshToken, "id">): Promise<RefreshToken> {
      const [token] = await db.insert(refreshTokens).values(input).returning();
      return token;
    },

    async findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
      const [token] = await db
        .select()
        .from(refreshTokens)
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
        .limit(1);
      return token;
    },

    async consumeActiveByHash(tokenHash: string): Promise<RefreshToken | undefined> {
      return db.transaction(async (tx) => {
        const [token] = await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
          .returning();
        return token;
      });
    },

    async revoke(tokenHash: string): Promise<void> {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
    },

    async deleteExpired(): Promise<void> {
      await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
    },
  };
}

export type RefreshTokensRepository = ReturnType<typeof createRefreshTokensRepository>;
