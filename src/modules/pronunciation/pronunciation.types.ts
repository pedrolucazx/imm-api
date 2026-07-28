import { z } from "zod";

// Multipart form fields alongside the audio file part (see parseAudioMultipart).
export const analyzePronunciationSchema = z.object({
  habitId: z.uuid(),
  originalText: z.string().min(1).max(500),
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

export type AnalyzePronunciationInput = z.infer<typeof analyzePronunciationSchema> & {
  audioBuffer: Buffer;
  mimeType: string;
};
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
  createdAt: Date;
};
