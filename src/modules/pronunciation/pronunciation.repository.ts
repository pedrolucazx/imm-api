import { and, eq, sql, desc } from "drizzle-orm";
import type { DrizzleDb } from "../../core/database/connection.js";
import {
  pronunciationEntries,
  type PronunciationEntry,
  type NewPronunciationEntry,
} from "../../core/database/schema/index.js";
import type { WordCloudItem } from "./pronunciation.types.js";

export function createPronunciationRepository(db: DrizzleDb) {
  return {
    async create(data: NewPronunciationEntry): Promise<PronunciationEntry> {
      const [entry] = await db.insert(pronunciationEntries).values(data).returning();
      return entry;
    },

    async getWordCloud(userId: string, habitId: string, limit = 50): Promise<WordCloudItem[]> {
      const rows = await db.execute(sql`
        SELECT word, COUNT(*)::int AS frequency
        FROM ${pronunciationEntries},
             unnest(${pronunciationEntries.missedWords}) AS word
        WHERE ${pronunciationEntries.userId} = ${userId}::uuid
          AND ${pronunciationEntries.habitId} = ${habitId}::uuid
        GROUP BY word
        ORDER BY frequency DESC
        LIMIT ${limit}
      `);
      return rows as unknown as WordCloudItem[];
    },

    async findLatestByHabitAndDate(
      habitId: string,
      userId: string,
      date: string
    ): Promise<PronunciationEntry | null> {
      const [entry] = await db
        .select()
        .from(pronunciationEntries)
        .where(
          and(
            eq(pronunciationEntries.habitId, habitId),
            eq(pronunciationEntries.userId, userId),
            eq(pronunciationEntries.entryDate, date)
          )
        )
        .orderBy(desc(pronunciationEntries.createdAt))
        .limit(1);
      return entry ?? null;
    },
  };
}

export type PronunciationRepository = ReturnType<typeof createPronunciationRepository>;
