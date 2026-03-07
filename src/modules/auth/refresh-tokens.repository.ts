import { eq, and, isNull, lt } from "drizzle-orm";
import { getDb } from "../../core/database/connection.js";
import {
  refreshTokens,
  type NewRefreshToken,
  type RefreshToken,
} from "../../core/database/schema/refresh-tokens.schema.js";

export class RefreshTokensRepository {
  async create(input: Omit<NewRefreshToken, "id">): Promise<RefreshToken> {
    const db = getDb();
    const [token] = await db.insert(refreshTokens).values(input).returning();
    return token;
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const db = getDb();
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
      .limit(1);
    return token;
  }

  // UPDATE atômico previne uso concorrente do mesmo token (race condition)
  async consumeActiveByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const [token] = await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
        .returning();

      return token;
    });

    return result;
  }

  async revoke(tokenHash: string): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }

  async deleteExpired(): Promise<void> {
    const db = getDb();
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
  }
}

export const refreshTokensRepository = new RefreshTokensRepository();
