import { eq, and } from "drizzle-orm";
import type { DrizzleDb } from "@/core/database/connection.js";
import {
  consents,
  type Consent,
  type ConsentType,
} from "@/core/database/schema/consents.schema.js";

/** Repository interface for consent data access. */
export interface ConsentsRepository {
  /** Saves or updates a consent record for a user. */
  save(userId: string, type: ConsentType, version: string): Promise<Consent>;
  /** Finds all consent records for a user. */
  findByUserId(userId: string): Promise<Consent[]>;
  /** Finds a specific consent record by user ID and type. */
  findByUserIdAndType(userId: string, type: ConsentType): Promise<Consent | null>;
}

/**
 * Creates a consents repository instance.
 * @param db - Drizzle database instance
 * @returns ConsentsRepository implementation
 */
export function createConsentsRepository(db: DrizzleDb): ConsentsRepository {
  return {
    /**
     * Saves or updates a consent record atomically using upsert.
     * Uses INSERT ... ON CONFLICT DO UPDATE to avoid race conditions.
     */
    async save(userId: string, type: ConsentType, version: string): Promise<Consent> {
      const now = new Date();

      const result = await db
        .insert(consents)
        .values({ userId, type, version, acceptedAt: now })
        .onConflictDoUpdate({
          target: [consents.userId, consents.type],
          set: { version, acceptedAt: now },
        })
        .returning();

      return result[0];
    },

    /**
     * Retrieves all consent records for a user.
     * @param userId - The user's ID
     * @returns Array of consent records
     */
    async findByUserId(userId: string): Promise<Consent[]> {
      return db.query.consents.findMany({
        where: eq(consents.userId, userId),
      });
    },

    /**
     * Retrieves a specific consent record by user ID and type.
     * @param userId - The user's ID
     * @param type - The consent type
     * @returns The consent record or null if not found
     */
    async findByUserIdAndType(userId: string, type: ConsentType): Promise<Consent | null> {
      const result = await db.query.consents.findFirst({
        where: and(eq(consents.userId, userId), eq(consents.type, type)),
      });
      return result ?? null;
    },
  };
}
