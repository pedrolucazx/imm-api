import { and, eq, gte, isNotNull, avg, count, sum, inArray, sql } from "drizzle-orm";
import { format, subDays } from "date-fns";
import type { DrizzleDb } from "../../core/database/connection.js";
import {
  habits,
  habitLogs,
  journalEntries,
  userProfiles,
  pronunciationEntries,
  type Habit,
  type HabitLog,
} from "../../core/database/schema/index.js";
import type { WordCloudItem } from "../pronunciation/pronunciation.types.js";

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
      const [result] = await db.execute<{ hour: number }>(sql`
        SELECT EXTRACT(HOUR FROM ${journalEntries.createdAt} AT TIME ZONE ${timezone})::int AS hour,
               COUNT(*) AS cnt
        FROM ${journalEntries}
        WHERE ${journalEntries.userId} = ${userId}::uuid
        GROUP BY 1
        ORDER BY cnt DESC
        LIMIT 1
      `);

      return result?.hour ?? null;
    },

    async getWordCloudByHabitIds(
      userId: string,
      habitIds: string[],
      limit = 50
    ): Promise<Map<string, WordCloudItem[]>> {
      if (habitIds.length === 0) return new Map();

      const habitIdParams = sql.join(
        habitIds.map((id) => sql`${id}::uuid`),
        sql`, `
      );
      const rows = await db.execute(sql`
        SELECT habit_id, word, COUNT(*)::int AS frequency
        FROM ${pronunciationEntries},
             unnest(${pronunciationEntries.missedWords}) AS word
        WHERE ${pronunciationEntries.userId} = ${userId}::uuid
          AND ${pronunciationEntries.habitId} = ANY(ARRAY[${habitIdParams}])
        GROUP BY habit_id, word
        ORDER BY habit_id, frequency DESC
      `);

      const result = new Map<string, WordCloudItem[]>();
      for (const row of rows as unknown as Array<{
        habit_id: string;
        word: string;
        frequency: number;
      }>) {
        const arr = result.get(row.habit_id) ?? [];
        if (arr.length < limit) arr.push({ word: row.word, frequency: row.frequency });
        result.set(row.habit_id, arr);
      }
      return result;
    },
  };
}

export type AnalyticsRepository = ReturnType<typeof createAnalyticsRepository>;
