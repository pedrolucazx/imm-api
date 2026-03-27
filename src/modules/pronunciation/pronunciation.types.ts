import { z } from "zod";

export const analyzePronunciationSchema = z.object({
  habitId: z.uuid(),
  audioUrl: z.url(),
  originalText: z.string().min(1),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (d) => {
        const parsed = new Date(`${d}T00:00:00Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(d);
      },
      { message: "Invalid calendar date" }
    )
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
