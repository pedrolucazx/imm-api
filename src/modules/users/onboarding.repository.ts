import { eq, sql } from "drizzle-orm";
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
      const { completedAt, ...rest } = data;
      const conflictSet = {
        ...rest,
        updatedAt: new Date(),
        ...(completedAt !== undefined && {
          completedAt:
            completedAt === null
              ? null
              : sql<Date | null>`COALESCE("onboarding_sessions"."completed_at", EXCLUDED.completed_at)`,
        }),
      };

      const [session] = await client
        .insert(onboardingSessions)
        .values({ userId, ...data })
        .onConflictDoUpdate({
          target: onboardingSessions.userId,
          set: conflictSet,
        })
        .returning();
      return session;
    },
  };
}

export type OnboardingRepository = ReturnType<typeof createOnboardingRepository>;
