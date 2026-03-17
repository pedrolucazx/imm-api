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
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
