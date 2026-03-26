import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_REGEX = /^([01]\d|2[0-3]):00$/;

export const habitStatSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  currentDay: z.number(),
  streak: z.number(),
  bestStreak: z.number(),
  consistencyRate: z.number(),
  totalCompletedDays: z.number(),
  targetSkill: z.string().nullable(),
  planStatus: z.string(),
  habitPlan: z.record(z.string(), z.unknown()).nullable(),
  logs: z.array(z.object({ logDate: z.string().regex(ISO_DATE_REGEX), completed: z.boolean() })),
  scoreTimeline: z
    .array(
      z.object({
        date: z.string().regex(ISO_DATE_REGEX),
        grammarScore: z.number(),
        vocabularyScore: z.number(),
        fluencyScore: z.number(),
      })
    )
    .nullable(),
});

export const globalStatsSchema = z.object({
  completionRateToday: z.number(),
  avgConsistencyRate: z.number(),
  totalJournalEntries: z.number(),
  totalWords: z.number(),
  avgWordsPerEntry: z.number(),
  avgMood: z.number().nullable(),
  avgEnergy: z.number().nullable(),
  aiRequestsToday: z.number(),
  moodConsistencyCorrelation: z
    .object({
      highMoodRate: z.number(),
      lowMoodRate: z.number(),
    })
    .nullable(),
  bestPerformanceHour: z.string().regex(HOUR_REGEX).nullable(),
});

export const moodTimelineEntrySchema = z.object({
  date: z.string().regex(ISO_DATE_REGEX),
  mood: z.number().nullable(),
  energy: z.number().nullable(),
});

export const analyticsSummarySchema = z.object({
  habits: z.array(habitStatSchema),
  global: globalStatsSchema,
  moodTimeline: z.array(moodTimelineEntrySchema),
});

export const habitIdQuerySchema = z.object({
  habitId: z.string().uuid().optional(),
  timezone: z
    .string()
    .min(1)
    .max(100)
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid IANA timezone" }
    )
    .optional()
    .default("UTC"),
});

export type HabitStat = z.infer<typeof habitStatSchema>;
export type GlobalStats = z.infer<typeof globalStatsSchema>;
export type MoodTimelineEntry = z.infer<typeof moodTimelineEntrySchema>;
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;
export type HabitIdQuery = z.infer<typeof habitIdQuerySchema>;
