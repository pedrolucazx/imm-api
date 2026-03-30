import { eq } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import { onboardingSessions, type OnboardingSession } from "../../core/database/schema/index.js";

export function createOnboardingRepository(db: DrizzleDb) {
  return {
    async findByUserId(userId: string, tx?: DbClient): Promise<OnboardingSession | undefined> {
      const client = tx ?? db;
      const [session] = await client
        .select()
        .from(onboardingSessions)
        .where(eq(onboardingSessions.userId, userId));
      return session;
    },

    async create(userId: string, tx?: DbClient): Promise<OnboardingSession> {
      const client = tx ?? db;
      const [session] = await client.insert(onboardingSessions).values({ userId }).returning();
      return session;
    },

    async upsert(
      userId: string,
      data: {
        currentStep?: number;
        skipped?: boolean;
        completed?: boolean;
        completedAt?: Date | null;
        updatedAt?: Date;
      },
      tx?: DbClient
    ): Promise<OnboardingSession> {
      const client = tx ?? db;
      const [session] = await client
        .insert(onboardingSessions)
        .values({ userId, ...data })
        .onConflictDoUpdate({
          target: onboardingSessions.userId,
          set: { ...data, updatedAt: new Date() },
        })
        .returning();
      return session;
    },
  };
}

export type OnboardingRepository = ReturnType<typeof createOnboardingRepository>;
