import { z } from "zod";

const httpsStorageUrl = z
  .string()
  .url()
  .refine((val) => val.startsWith("https://"), { message: "Audio URL must use HTTPS" })
  .refine((val) => /\/storage\/v1\/object\/public\/audio-entries\//.test(val), {
    message: "Audio URL must point to the project audio storage",
  });

export const createJournalEntrySchema = z.object({
  habitId: z.uuid(),
  content: z.string().min(1),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  moodScore: z.number().int().min(1).max(5).optional(),
  energyScore: z.number().int().min(1).max(5).optional(),
  audioUrl: httpsStorageUrl.optional(),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const transcribeSchema = z.object({
  habitId: z.uuid(),
  audioUrl: httpsStorageUrl,
});

export type TranscribeInput = z.infer<typeof transcribeSchema>;
