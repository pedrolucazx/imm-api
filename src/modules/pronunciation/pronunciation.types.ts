import { z } from "zod";

export const analyzePronunciationSchema = z.object({
  habitId: z.uuid(),
  audioUrl: z.url(),
  originalText: z.string().min(1),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => !Number.isNaN(new Date(d).getTime()), { message: "Invalid calendar date" })
    .optional(),
});

export const wordCloudQuerySchema = z.object({
  habitId: z.uuid(),
});

export type AnalyzePronunciationInput = z.infer<typeof analyzePronunciationSchema>;
export type WordCloudQuery = z.infer<typeof wordCloudQuerySchema>;

export type WordCloudItem = {
  word: string;
  frequency: number;
};

export type AnalyzePronunciationResult = {
  id: string;
  userId: string;
  habitId: string;
  entryDate: string;
  originalText: string;
  transcription: string | null;
  score: number | null;
  missedWords: string[];
  correctWords: string[];
  extraWords: string[];
  audioUrl: string | null;
  createdAt: Date;
};
