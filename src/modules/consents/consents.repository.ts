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
     * Saves or updates a consent record.
     * If a record exists for the user and type, it updates; otherwise inserts.
     */
    async save(userId: string, type: ConsentType, version: string): Promise<Consent> {
      const now = new Date();
      const existing = await db.query.consents.findFirst({
        where: and(eq(consents.userId, userId), eq(consents.type, type)),
      });

      if (existing) {
        const updated = await db
          .update(consents)
          .set({ version, acceptedAt: now })
          .where(and(eq(consents.userId, userId), eq(consents.type, type)))
          .returning();
        return updated[0];
      }

      const inserted = await db
        .insert(consents)
        .values({ userId, type, version, acceptedAt: now })
        .returning();
      return inserted[0];
    },

    /** Retrieves all consent records for a user. */
    async findByUserId(userId: string): Promise<Consent[]> {
      return db.query.consents.findMany({
        where: eq(consents.userId, userId),
      });
    },

    /** Retrieves a specific consent record by user ID and type. */
    async findByUserIdAndType(userId: string, type: ConsentType): Promise<Consent | null> {
      const result = await db.query.consents.findFirst({
        where: and(eq(consents.userId, userId), eq(consents.type, type)),
      });
      return result ?? null;
    },
  };
}
