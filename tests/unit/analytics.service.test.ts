import { createAnalyticsService } from "@/modules/analytics/analytics.service.js";
import type { AnalyticsRepository } from "@/modules/analytics/analytics.repository.js";

jest.mock("@/shared/schemas/habit-mode.js", () => ({
  SKILL_BUILDING_LOCALE_SET: new Set([
    "en-US",
    "pt-BR",
    "es-ES",
    "fr-FR",
    "de-DE",
    "it-IT",
    "ja-JP",
    "zh-CN",
    "ko-KR",
  ]),
}));

describe("AnalyticsService — wordCloud integration", () => {
  function makeMockRepo() {
    return {
      findActiveHabits: jest.fn(),
      findLogsByHabitIds: jest.fn(),
      countJournalEntries: jest.fn().mockResolvedValue(0),
      getJournalWordStats: jest.fn().mockResolvedValue({ total: 0, avg: 0 }),
      getAvgMoodEnergy: jest.fn().mockResolvedValue({ avgMood: null, avgEnergy: null }),
      getMoodTimeline: jest.fn().mockResolvedValue([]),
      getUserProfile: jest.fn().mockResolvedValue({ aiRequestsToday: 0 }),
      countTodayCompletedHabits: jest.fn().mockResolvedValue(0),
      getMoodConsistencyCorrelation: jest.fn().mockResolvedValue([]),
      getBestPerformanceHour: jest.fn().mockResolvedValue(null),
      getScoreTimeline: jest.fn().mockResolvedValue([]),
      getWordCloudByHabitIds: jest.fn(),
    } as unknown as jest.Mocked<AnalyticsRepository>;
  }

  const mockLanguageHabit = {
    id: "habit-uuid-1",
    userId: "user-uuid-1",
    name: "English Practice",
    targetSkill: "en-US",
    icon: "🌍",
    color: "#4299e1",
    frequency: "daily",
    targetDays: 7,
    isActive: true,
    sortOrder: 0,
    startDate: "2026-03-01",
    habitPlan: {},
    planStatus: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFitnessHabit = {
    id: "habit-uuid-2",
    userId: "user-uuid-1",
    name: "Fitness",
    targetSkill: "fitness",
    icon: "💪",
    color: "#48bb78",
    frequency: "daily",
    targetDays: 7,
    isActive: true,
    sortOrder: 1,
    startDate: "2026-03-01",
    habitPlan: {},
    planStatus: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns wordCloud: null for non-language habits", async () => {
    const repo = makeMockRepo();
    repo.findActiveHabits.mockResolvedValue([mockFitnessHabit]);
    repo.findLogsByHabitIds.mockResolvedValue([]);
    repo.getWordCloudByHabitIds.mockResolvedValue(new Map());

    const service = createAnalyticsService({ analyticsRepo: repo });
    const result = await service.getSummary("user-uuid-1");

    expect(result.habits[0].wordCloud).toBeNull();
  });

  it("returns wordCloud: [] for language habits with no pronunciation entries", async () => {
    const repo = makeMockRepo();
    repo.findActiveHabits.mockResolvedValue([mockLanguageHabit]);
    repo.findLogsByHabitIds.mockResolvedValue([]);
    repo.getScoreTimeline.mockResolvedValue([]);
    repo.getWordCloudByHabitIds.mockResolvedValue(new Map());

    const service = createAnalyticsService({ analyticsRepo: repo });
    const result = await service.getSummary("user-uuid-1");

    expect(result.habits[0].wordCloud).toEqual([]);
  });

  it("returns populated wordCloud for language habits with pronunciation entries", async () => {
    const repo = makeMockRepo();
    repo.findActiveHabits.mockResolvedValue([mockLanguageHabit]);
    repo.findLogsByHabitIds.mockResolvedValue([]);
    repo.getScoreTimeline.mockResolvedValue([]);
    repo.getWordCloudByHabitIds.mockResolvedValue(
      new Map([
        [
          "habit-uuid-1",
          [
            { word: "difficult", frequency: 5 },
            { word: "pronunciation", frequency: 3 },
          ],
        ],
      ])
    );

    const service = createAnalyticsService({ analyticsRepo: repo });
    const result = await service.getSummary("user-uuid-1");

    expect(result.habits[0].wordCloud).toEqual([
      { word: "difficult", frequency: 5 },
      { word: "pronunciation", frequency: 3 },
    ]);
  });

  it("only fetches wordCloud for language habit ids", async () => {
    const repo = makeMockRepo();
    repo.findActiveHabits.mockResolvedValue([mockLanguageHabit, mockFitnessHabit]);
    repo.findLogsByHabitIds.mockResolvedValue([]);
    repo.getScoreTimeline.mockResolvedValue([]);
    repo.getWordCloudByHabitIds.mockResolvedValue(new Map());

    const service = createAnalyticsService({ analyticsRepo: repo });
    await service.getSummary("user-uuid-1");

    expect(repo.getWordCloudByHabitIds).toHaveBeenCalledWith(
      "user-uuid-1",
      ["habit-uuid-1"] // Only language habit
    );
  });

  it("includes wordCloud in filtered habit results when filtering by habitId", async () => {
    const repo = makeMockRepo();
    repo.findActiveHabits.mockResolvedValue([mockLanguageHabit, mockFitnessHabit]);
    repo.findLogsByHabitIds.mockResolvedValue([]);
    repo.getScoreTimeline.mockResolvedValue([]);
    repo.getWordCloudByHabitIds.mockResolvedValue(
      new Map([["habit-uuid-1", [{ word: "difficult", frequency: 5 }]]])
    );

    const service = createAnalyticsService({ analyticsRepo: repo });
    const result = await service.getSummary("user-uuid-1", "habit-uuid-1");

    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].id).toBe("habit-uuid-1");
    expect(result.habits[0].wordCloud).toEqual([{ word: "difficult", frequency: 5 }]);
  });
});
