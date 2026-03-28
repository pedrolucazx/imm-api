import { z } from "zod";

export const createJournalEntrySchema = z.object({
  habitId: z.uuid(),
  content: z.string().min(1),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  moodScore: z.number().int().min(1).max(5).optional(),
  energyScore: z.number().int().min(1).max(5).optional(),
  audioUrl: z.string().url().optional(),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const transcribeSchema = z.object({
  habitId: z.uuid(),
  audioUrl: z.string().url(),
});

export type TranscribeInput = z.infer<typeof transcribeSchema>;
