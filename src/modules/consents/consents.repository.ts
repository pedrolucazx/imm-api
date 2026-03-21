import { eq, and } from "drizzle-orm";
import type { DrizzleDb } from "@/core/database/connection.js";
import {
  consents,
  type Consent,
  type ConsentType,
} from "@/core/database/schema/consents.schema.js";

export interface ConsentsRepository {
  save(userId: string, type: ConsentType, version: string): Promise<Consent>;
  findByUserId(userId: string): Promise<Consent[]>;
  findByUserIdAndType(userId: string, type: ConsentType): Promise<Consent | null>;
}

export function createConsentsRepository(db: DrizzleDb): ConsentsRepository {
  return {
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

    async findByUserId(userId: string): Promise<Consent[]> {
      return db.query.consents.findMany({
        where: eq(consents.userId, userId),
      });
    },

    async findByUserIdAndType(userId: string, type: ConsentType): Promise<Consent | null> {
      const result = await db.query.consents.findFirst({
        where: and(eq(consents.userId, userId), eq(consents.type, type)),
      });
      return result ?? null;
    },
  };
}
