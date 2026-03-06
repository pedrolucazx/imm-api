import { eq, and, isNull } from "drizzle-orm";
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

  async revoke(tokenHash: string): Promise<void> {
    const db = getDb();
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async deleteExpired(): Promise<void> {
    const db = getDb();
    await db.delete(refreshTokens).where(eq(refreshTokens.expiresAt, new Date()));
  }
}

export const refreshTokensRepository = new RefreshTokensRepository();
