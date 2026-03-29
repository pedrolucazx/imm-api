import { and, eq, desc } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import {
  journalEntries,
  type JournalEntry,
  type NewJournalEntry,
} from "../../core/database/schema/index.js";

type MutableJournalFields = Partial<Omit<NewJournalEntry, "id" | "userId" | "createdAt">>;

export function createJournalRepository(db: DrizzleDb) {
  return {
    async findById(id: string, userId: string): Promise<JournalEntry | null> {
      const [entry] = await db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
      return entry ?? null;
    },

    async findByHabitAndDate(
      habitId: string,
      userId: string,
      entryDate: string
    ): Promise<JournalEntry | null> {
      const [entry] = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.habitId, habitId),
            eq(journalEntries.userId, userId),
            eq(journalEntries.entryDate, entryDate)
          )
        );
      return entry ?? null;
    },

    async findAllByHabitId(
      habitId: string,
      userId: string,
      limit: number = 30
    ): Promise<JournalEntry[]> {
      return db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.habitId, habitId), eq(journalEntries.userId, userId)))
        .orderBy(desc(journalEntries.entryDate))
        .limit(limit);
    },

    async findAllByDate(userId: string, entryDate: string): Promise<JournalEntry[]> {
      return db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, entryDate)));
    },

    async findAllByUserId(userId: string, limit: number = 100): Promise<JournalEntry[]> {
      return db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId))
        .orderBy(desc(journalEntries.createdAt))
        .limit(limit);
    },

    async create(data: NewJournalEntry): Promise<JournalEntry> {
      const [entry] = await db.insert(journalEntries).values(data).returning();
      return entry;
    },

    async upsert(data: NewJournalEntry & { existingId?: string }): Promise<JournalEntry> {
      if (data.existingId) {
        const [entry] = await db
          .update(journalEntries)
          .set({
            content: data.content,
            wordCount: data.wordCount,
            moodScore: data.moodScore,
            energyScore: data.energyScore,
            audioUrl: data.audioUrl ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(journalEntries.id, data.existingId), eq(journalEntries.userId, data.userId))
          )
          .returning();
        return entry;
      }

      const [entry] = await db.insert(journalEntries).values(data).returning();
      return entry;
    },

    async update(
      id: string,
      userId: string,
      data: MutableJournalFields,
      tx?: DbClient
    ): Promise<JournalEntry | undefined> {
      const client = tx ?? db;
      const fields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as MutableJournalFields;
      if (Object.keys(fields).length === 0) return undefined;

      const [entry] = await client
        .update(journalEntries)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
        .returning();
      return entry;
    },

    async clearAiFeedback(id: string, userId: string): Promise<JournalEntry | undefined> {
      const [entry] = await db
        .update(journalEntries)
        .set({ aiFeedback: null, aiAgentType: null, updatedAt: new Date() })
        .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
        .returning();
      return entry;
    },
  };
}

export type JournalRepository = ReturnType<typeof createJournalRepository>;
