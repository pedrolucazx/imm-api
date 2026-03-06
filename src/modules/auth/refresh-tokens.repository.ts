import { eq, and, isNull, lt } from "drizzle-orm";
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
   * Atomically finds and revokes a refresh token.
   * Prevents race conditions where concurrent requests could use the same token.
   * @param tokenHash - The hashed refresh token
   * @returns The refresh token if found and not revoked, undefined otherwise
   */
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

  /**
   * Revokes a refresh token by setting its revokedAt timestamp.
   * @param tokenHash - The hashed refresh token to revoke
   */
  async revoke(tokenHash: string): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }

  /**
   * Deletes all expired refresh tokens from the database.
   */
  async deleteExpired(): Promise<void> {
    const db = getDb();
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
  }
}

export const refreshTokensRepository = new RefreshTokensRepository();
