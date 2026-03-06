import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../../core/database/connection.js";
import {
  refreshTokens,
  type NewRefreshToken,
  type RefreshToken,
} from "../../core/database/schema/refresh-tokens.schema.js";

/**
 * Repository for managing refresh tokens in the database.
 */
export class RefreshTokensRepository {
  /**
   * Creates a new refresh token in the database.
   * @param input - The refresh token data (userId, tokenHash, expiresAt)
   * @returns The created refresh token
   */
  async create(input: Omit<NewRefreshToken, "id">): Promise<RefreshToken> {
    const db = getDb();
    const [token] = await db.insert(refreshTokens).values(input).returning();
    return token;
  }

  /**
   * Finds a refresh token by its hash.
   * @param tokenHash - The hashed refresh token
   * @returns The refresh token if found and not revoked, undefined otherwise
   */
  async findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const db = getDb();
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
      .limit(1);
    return token;
  }

  /**
   * Revokes a refresh token by setting its revokedAt timestamp.
   * @param tokenHash - The hashed refresh token to revoke
   */
  async revoke(tokenHash: string): Promise<void> {
    const db = getDb();
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  /**
   * Deletes all expired refresh tokens from the database.
   */
  async deleteExpired(): Promise<void> {
    const db = getDb();
    await db.delete(refreshTokens).where(eq(refreshTokens.expiresAt, new Date()));
  }
}

export const refreshTokensRepository = new RefreshTokensRepository();
