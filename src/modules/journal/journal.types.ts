import { z } from "zod";

/**
 * Schema for creating a journal entry.
 */
export const createJournalEntrySchema = z.object({
  habitId: z.uuid(),
  content: z.string().min(1),
  moodScore: z.number().int().min(1).max(5).optional(),
  energyScore: z.number().int().min(1).max(5).optional(),
});

/**
 * Schema for updating a journal entry.
 */
export const updateJournalEntrySchema = z.object({
  content: z.string().min(1).optional(),
  moodScore: z.number().int().min(1).max(5).optional(),
  energyScore: z.number().int().min(1).max(5).optional(),
});

/**
 * Type inferred from createJournalEntrySchema
 */
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

/**
 * Type inferred from updateJournalEntrySchema
 */
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
