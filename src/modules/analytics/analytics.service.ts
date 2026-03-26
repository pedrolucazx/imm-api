import { differenceInCalendarDays, parseISO } from "date-fns";
import type { AnalyticsRepository } from "./analytics.repository.js";
import type { HabitLog } from "../../core/database/schema/index.js";
import {
  computeStreak,
  computeCurrentDay,
  computeBestStreak,
} from "../../shared/utils/habit-math.js";
import { getTodayUTCString } from "../../shared/utils/date.js";
import { SKILL_BUILDING_LOCALE_SET } from "../../shared/schemas/habit-mode.js";
import type { AnalyticsSummary, HabitStat } from "./analytics.types.js";

function computeConsistencyRate(logs: HabitLog[], startDate: string | Date | null): number {
  if (!startDate) return 0;
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  const daysSinceStart = Math.max(1, differenceInCalendarDays(new Date(), start) + 1);
  const completedCount = logs.filter((l) => l.completed).length;
  return Math.round((completedCount / daysSinceStart) * 1000) / 1000;
}

type AnalyticsServiceDeps = {
  analyticsRepo: AnalyticsRepository;
};

type AiFeedbackLinguistic = {
  linguistic?: {
    grammarScore?: number;
    vocabularyScore?: number;
    fluencyScore?: number;
  };
};

export function createAnalyticsService({ analyticsRepo }: AnalyticsServiceDeps) {
  return {
    async getSummary(
      userId: string,
      habitId?: string,
      timezone = "UTC"
    ): Promise<AnalyticsSummary> {
      const today = getTodayUTCString();

      // Fetch active habits
      const allHabits = await analyticsRepo.findActiveHabits(userId);
      const filteredHabits = habitId ? allHabits.filter((h) => h.id === habitId) : allHabits;
      const habitIds = allHabits.map((h) => h.id);

      // Fetch logs for all habits
      const allLogs = await analyticsRepo.findLogsByHabitIds(habitIds);
      const logsByHabit = new Map<string, HabitLog[]>();
      for (const log of allLogs) {
        const arr = logsByHabit.get(log.habitId) ?? [];
        arr.push(log);
        logsByHabit.set(log.habitId, arr);
      }

      // Fetch score timeline entries for filtered language-skill habits
      const languageHabitIds = filteredHabits
        .filter((h) => h.targetSkill != null && SKILL_BUILDING_LOCALE_SET.has(h.targetSkill))
        .map((h) => h.id);
      const scoreTimelineRows = await analyticsRepo.getScoreTimeline(languageHabitIds);

      // Group timeline rows by habitId
      const timelineByHabit = new Map<
        string,
        Array<{ date: string; grammarScore: number; vocabularyScore: number; fluencyScore: number }>
      >();
      for (const row of scoreTimelineRows) {
        const feedback = row.aiFeedback as AiFeedbackLinguistic;
        const grammarScore = feedback?.linguistic?.grammarScore;
        const vocabularyScore = feedback?.linguistic?.vocabularyScore;
        const fluencyScore = feedback?.linguistic?.fluencyScore;
        if (
          grammarScore == null ||
          vocabularyScore == null ||
          fluencyScore == null ||
          Number.isNaN(grammarScore) ||
          Number.isNaN(vocabularyScore) ||
          Number.isNaN(fluencyScore)
        ) {
          continue;
        }
        const arr = timelineByHabit.get(row.habitId) ?? [];
        arr.push({ date: row.date, grammarScore, vocabularyScore, fluencyScore });
        timelineByHabit.set(row.habitId, arr);
      }

      // Compute per-habit stats (filtered)
      const habits: HabitStat[] = filteredHabits.map((habit) => {
        const logs = logsByHabit.get(habit.id) ?? [];
        const isLanguageHabit =
          habit.targetSkill != null && SKILL_BUILDING_LOCALE_SET.has(habit.targetSkill);
        return {
          id: habit.id,
          name: habit.name,
          icon: habit.icon,
          color: habit.color,
          currentDay: computeCurrentDay(habit.startDate),
          streak: computeStreak(logs),
          bestStreak: computeBestStreak(logs),
          consistencyRate: computeConsistencyRate(logs, habit.startDate),
          totalCompletedDays: logs.filter((l) => l.completed).length,
          targetSkill: habit.targetSkill ?? null,
          planStatus: habit.planStatus,
          habitPlan: habit.habitPlan ?? null,
          logs: logs.map((l) => ({ logDate: l.logDate, completed: l.completed })),
          scoreTimeline: isLanguageHabit ? (timelineByHabit.get(habit.id) ?? []) : null,
        };
      });

      const avgConsistencyRate =
        allHabits.length > 0
          ? Math.round(
              (allHabits.reduce((sum, habit) => {
                const logs = logsByHabit.get(habit.id) ?? [];
                return sum + computeConsistencyRate(logs, habit.startDate);
              }, 0) /
                allHabits.length) *
                1000
            ) / 1000
          : 0;

      // Global stats
      const [
        journalCount,
        wordStats,
        moodStats,
        profile,
        completedToday,
        moodCorrelationRows,
        bestHour,
      ] = await Promise.all([
        analyticsRepo.countJournalEntries(userId),
        analyticsRepo.getJournalWordStats(userId),
        analyticsRepo.getAvgMoodEnergy(userId),
        analyticsRepo.getUserProfile(userId),
        analyticsRepo.countTodayCompletedHabits(today, habitIds),
        analyticsRepo.getMoodConsistencyCorrelation(userId),
        analyticsRepo.getBestPerformanceHour(userId, timezone),
      ]);

      // Compute mood consistency correlation
      const highRows = moodCorrelationRows.filter((r) => r.mood >= 4);
      const lowRows = moodCorrelationRows.filter((r) => r.mood <= 3);
      const moodConsistencyCorrelation =
        moodCorrelationRows.length > 0
          ? {
              highMoodRate:
                highRows.length > 0
                  ? Math.round(
                      (highRows.filter((r) => r.completed).length / highRows.length) * 1000
                    ) / 1000
                  : 0,
              lowMoodRate:
                lowRows.length > 0
                  ? Math.round(
                      (lowRows.filter((r) => r.completed).length / lowRows.length) * 1000
                    ) / 1000
                  : 0,
            }
          : null;

      // Format best performance hour
      const bestPerformanceHour =
        bestHour != null ? `${String(bestHour).padStart(2, "0")}:00` : null;

      const global = {
        completionRateToday:
          habitIds.length > 0 ? Math.round((completedToday / habitIds.length) * 100) / 100 : 0,
        avgConsistencyRate,
        totalJournalEntries: journalCount,
        totalWords: wordStats.total,
        avgWordsPerEntry: wordStats.avg,
        avgMood: moodStats.avgMood,
        avgEnergy: moodStats.avgEnergy,
        aiRequestsToday: profile?.aiRequestsToday ?? 0,
        moodConsistencyCorrelation,
        bestPerformanceHour,
      };

      // Mood timeline (last 30 days with mood data)
      const moodTimeline = await analyticsRepo.getMoodTimeline(userId);

      return { habits, global, moodTimeline };
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
