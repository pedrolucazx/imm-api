import { and, eq, desc } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import {
  journalEntries,
  type JournalEntry,
  type NewJournalEntry,
} from "../../core/database/schema/index.js";

type MutableJournalFields = Partial<Omit<NewJournalEntry, "id" | "userId" | "createdAt">>;

/**
 * Factory function to create a JournalRepository instance.
 * @param db - The Drizzle database instance
 * @returns Repository with methods to access journal entries data
 */
export function createJournalRepository(db: DrizzleDb) {
  return {
    /**
     * Finds a journal entry by its ID and user ID.
     * @param id - The journal entry ID
     * @param userId - The user ID
     * @returns The journal entry or null if not found
     */
    async findById(id: string, userId: string): Promise<JournalEntry | null> {
      const [entry] = await db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
      return entry ?? null;
    },

    /**
     * Finds a journal entry by habit ID and date.
     * @param habitId - The habit ID
     * @param userId - The user ID
     * @param entryDate - The entry date in ISO format (YYYY-MM-DD)
     * @returns The journal entry or null if not found
     */
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

    /**
     * Finds all journal entries for a habit, ordered by date descending.
     * @param habitId - The habit ID
     * @param userId - The user ID
     * @param limit - Maximum number of entries to return (default 30)
     * @returns Array of journal entries
     */
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

    /**
     * Finds all journal entries for a user on a specific date.
     * @param userId - The user ID
     * @param entryDate - The entry date in ISO format (YYYY-MM-DD)
     * @returns Array of journal entries for that date
     */
    async findAllByDate(userId: string, entryDate: string): Promise<JournalEntry[]> {
      return db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, entryDate)));
    },

    /**
     * Creates a new journal entry.
     * @param data - The journal entry data to create
     * @returns The created journal entry
     */
    async create(data: NewJournalEntry): Promise<JournalEntry> {
      const [entry] = await db.insert(journalEntries).values(data).returning();
      return entry;
    },

    /**
     * Creates or updates a journal entry (idempotent operation).
     * @param data - The journal entry data with optional existingId
     * @returns The created or updated journal entry
     */
    async upsert(data: NewJournalEntry & { existingId?: string }): Promise<JournalEntry> {
      if (data.existingId) {
        const [entry] = await db
          .update(journalEntries)
          .set({
            content: data.content,
            wordCount: data.wordCount,
            moodScore: data.moodScore,
            energyScore: data.energyScore,
            updatedAt: new Date(),
          })
          .where(eq(journalEntries.id, data.existingId))
          .returning();
        return entry;
      }

      const [entry] = await db.insert(journalEntries).values(data).returning();
      return entry;
    },

    /**
     * Updates a journal entry with the given fields.
     * @param id - The journal entry ID
     * @param userId - The user ID
     * @param data - The fields to update
     * @param tx - Optional database transaction
     * @returns The updated journal entry or undefined if not found
     */
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

    /**
     * Clears the AI feedback from a journal entry.
     * @param id - The journal entry ID
     * @param userId - The user ID
     * @returns The updated journal entry or undefined if not found
     */
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

/**
 * Type representing the JournalRepository instance.
 */
export type JournalRepository = ReturnType<typeof createJournalRepository>;
