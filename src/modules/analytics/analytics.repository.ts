import { and, eq, gte, isNotNull, avg, count, sum, inArray, sql } from "drizzle-orm";
import { format, subDays } from "date-fns";
import type { DrizzleDb } from "../../core/database/connection.js";
import {
  habits,
  habitLogs,
  journalEntries,
  userProfiles,
  type Habit,
  type HabitLog,
} from "../../core/database/schema/index.js";

export function createAnalyticsRepository(db: DrizzleDb) {
  return {
    async findActiveHabits(userId: string): Promise<Habit[]> {
      return db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.isActive, true)));
    },

    async findLogsByHabitIds(habitIds: string[]): Promise<HabitLog[]> {
      if (habitIds.length === 0) return [];
      return db.select().from(habitLogs).where(inArray(habitLogs.habitId, habitIds));
    },

    async countJournalEntries(userId: string): Promise<number> {
      const [result] = await db
        .select({ count: count() })
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId));
      return result?.count ?? 0;
    },

    async getJournalWordStats(userId: string): Promise<{ total: number; avg: number }> {
      const [result] = await db
        .select({
          total: sum(journalEntries.wordCount),
          avg: avg(journalEntries.wordCount),
        })
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId));
      return {
        total: Number(result?.total ?? 0),
        avg: Math.round(Number(result?.avg ?? 0)),
      };
    },

    async getAvgMoodEnergy(
      userId: string
    ): Promise<{ avgMood: number | null; avgEnergy: number | null }> {
      const [result] = await db
        .select({
          avgMood: avg(journalEntries.moodScore),
          avgEnergy: avg(journalEntries.energyScore),
        })
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), isNotNull(journalEntries.moodScore)));
      return {
        avgMood: result?.avgMood != null ? Math.round(Number(result.avgMood) * 10) / 10 : null,
        avgEnergy:
          result?.avgEnergy != null ? Math.round(Number(result.avgEnergy) * 10) / 10 : null,
      };
    },

    async getMoodTimeline(
      userId: string
    ): Promise<Array<{ date: string; mood: number | null; energy: number | null }>> {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd");
      const rows = await db
        .select({
          entryDate: journalEntries.entryDate,
          mood: journalEntries.moodScore,
          energy: journalEntries.energyScore,
        })
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.userId, userId),
            isNotNull(journalEntries.moodScore),
            gte(journalEntries.entryDate, thirtyDaysAgo)
          )
        );
      return rows.map((r) => ({
        date: r.entryDate,
        mood: r.mood,
        energy: r.energy,
      }));
    },

    async getUserProfile(userId: string): Promise<{ aiRequestsToday: number } | null> {
      const [profile] = await db
        .select({ aiRequestsToday: userProfiles.aiRequestsToday })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      return profile ?? null;
    },

    async countTodayCompletedHabits(today: string, habitIds: string[]): Promise<number> {
      if (habitIds.length === 0) return 0;
      const [result] = await db
        .select({ count: count() })
        .from(habitLogs)
        .where(
          and(
            inArray(habitLogs.habitId, habitIds),
            eq(habitLogs.logDate, today),
            eq(habitLogs.completed, true)
          )
        );
      return result?.count ?? 0;
    },

    async getScoreTimeline(
      habitIds: string[]
    ): Promise<Array<{ habitId: string; date: string; aiFeedback: unknown }>> {
      if (habitIds.length === 0) return [];
      const rows = await db
        .select({
          habitId: journalEntries.habitId,
          date: journalEntries.entryDate,
          aiFeedback: journalEntries.aiFeedback,
        })
        .from(journalEntries)
        .where(
          and(
            inArray(journalEntries.habitId, habitIds),
            eq(journalEntries.aiAgentType, "language-teacher"),
            isNotNull(journalEntries.aiFeedback)
          )
        )
        .orderBy(journalEntries.entryDate);
      return rows.map((r) => ({
        habitId: r.habitId,
        date: r.date,
        aiFeedback: r.aiFeedback,
      }));
    },

    async getMoodConsistencyCorrelation(
      userId: string
    ): Promise<Array<{ mood: number; completed: boolean }>> {
      const rows = await db
        .select({
          mood: journalEntries.moodScore,
          completed: habitLogs.completed,
        })
        .from(journalEntries)
        .innerJoin(
          habitLogs,
          and(
            eq(journalEntries.habitId, habitLogs.habitId),
            eq(journalEntries.entryDate, habitLogs.logDate)
          )
        )
        .where(and(eq(journalEntries.userId, userId), isNotNull(journalEntries.moodScore)));
      return rows
        .filter((r) => r.mood != null)
        .map((r) => ({ mood: r.mood as number, completed: r.completed }));
    },

    async getBestPerformanceHour(userId: string, timezone: string): Promise<number | null> {
      const [result] = await db
        .select({
          hour: sql<number>`EXTRACT(HOUR FROM ${journalEntries.createdAt} AT TIME ZONE ${timezone})`.mapWith(
            Number
          ),
        })
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId))
        .groupBy(sql`EXTRACT(HOUR FROM ${journalEntries.createdAt} AT TIME ZONE ${timezone})`)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(1);

      return result?.hour ?? null;
    },
  };
}

export type AnalyticsRepository = ReturnType<typeof createAnalyticsRepository>;
