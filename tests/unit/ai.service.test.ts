import { createAiService, type AiServiceDeps } from "@/modules/ai-agents/ai.service.js";
import { NotFoundError, TooManyRequestsError } from "@/shared/errors/index.js";
import type { JournalRepository } from "@/modules/journal/journal.repository.js";
import type { HabitsRepository } from "@/modules/habits/habits.repository.js";
import type { UserProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import type { JournalEntry } from "@/core/database/schema/index.js";
import type { Habit } from "@/core/database/schema/index.js";
import type { UserProfile } from "@/core/database/schema/index.js";

jest.mock("@/modules/ai-agents/language-agent.js", () => ({
  analyzeWithLanguageAgent: jest.fn(),
}));

jest.mock("@/modules/ai-agents/behavioral-agent.js", () => ({
  analyzeWithBehavioralAgent: jest.fn(),
}));

import { analyzeWithLanguageAgent } from "@/modules/ai-agents/language-agent.js";
import { analyzeWithBehavioralAgent } from "@/modules/ai-agents/behavioral-agent.js";

const mockLanguageAgent = analyzeWithLanguageAgent as jest.MockedFunction<
  typeof analyzeWithLanguageAgent
>;
const mockBehavioralAgent = analyzeWithBehavioralAgent as jest.MockedFunction<
  typeof analyzeWithBehavioralAgent
>;

const mockJournalEntry: JournalEntry = {
  id: "journal-entry-id-1",
  userId: "user-id-1",
  habitId: "habit-id-1",
  entryDate: "2026-03-15",
  content: "Today I practiced English for 30 minutes.",
  wordCount: 8,
  uiLanguageSnap: "pt-BR",
  targetSkillSnap: "en-US",
  aiFeedback: null,
  aiAgentType: null,
  moodScore: 4,
  energyScore: 3,
  audioUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockHabit: Habit = {
  id: "habit-id-1",
  userId: "user-id-1",
  name: "English Practice",
  targetSkill: "en-US",
  icon: "🌍",
  color: "#4299e1",
  frequency: "daily",
  targetDays: 7,
  isActive: true,
  sortOrder: 0,
  startDate: null,
  habitPlan: {},
  planStatus: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProfile: UserProfile = {
  id: "profile-id-1",
  userId: "user-id-1",
  uiLanguage: "pt-BR",
  bio: null,
  timezone: "America/Sao_Paulo",
  aiRequestsToday: 2,
  lastAiRequest: new Date(Date.now() - 10_000),
};

function makeService() {
  const journalRepo = {
    findById: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<JournalRepository>;

  const habitsRepo = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<HabitsRepository>;

  const userProfilesRepo = {
    findByUserId: jest.fn(),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<UserProfilesRepository>;

  const textAI = { generate: jest.fn() };
  const deps: AiServiceDeps = { journalRepo, habitsRepo, userProfilesRepo, textAI };
  const service = createAiService(deps);

  return { service, journalRepo, habitsRepo, userProfilesRepo };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ai service", () => {
  describe("analyze", () => {
    it("throws NotFoundError when journal entry not found", async () => {
      const { service, userProfilesRepo } = makeService();
      userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);

      await expect(
        service.analyze({ journalEntryId: "invalid-id", habitId: "habit-id-1" }, "user-id-1")
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when habit not found", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue(null);
      userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);

      await expect(
        service.analyze(
          { journalEntryId: "journal-entry-id-1", habitId: "invalid-habit" },
          "user-id-1"
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when habit does not belong to journal entry", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue(mockHabit);
      userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);

      await expect(
        service.analyze(
          { journalEntryId: "journal-entry-id-1", habitId: "different-habit-id" },
          "user-id-1"
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("throws TooManyRequestsError when rate limit exceeded", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue(mockHabit);
      userProfilesRepo.findByUserId.mockResolvedValue({ ...mockProfile, aiRequestsToday: 15 });

      await expect(
        service.analyze(
          { journalEntryId: "journal-entry-id-1", habitId: "habit-id-1" },
          "user-id-1"
        )
      ).rejects.toThrow(TooManyRequestsError);
    });

    it("calls language agent for skill-building habits", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue({ ...mockHabit, targetSkill: "en-US" });
      userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      journalRepo.update.mockResolvedValue(mockJournalEntry);
      userProfilesRepo.upsert.mockResolvedValue(undefined);
      mockLanguageAgent.mockResolvedValue({
        agentType: "language-teacher",
        targetSkill: "en-US",
        linguistic: { grammarScore: 85, vocabularyScore: 90, fluencyScore: 80 },
        errors: [],
        modelSentence: "Great job!",
        nextChallenge: "Practice more",
      } as never);

      const result = await service.analyze(
        { journalEntryId: "journal-entry-id-1", habitId: "habit-id-1" },
        "user-id-1"
      );

      expect(mockLanguageAgent).toHaveBeenCalledWith(
        {
          targetSkill: "en-US",
          uiLanguage: "pt-BR",
          journalContent: mockJournalEntry.content,
          habitName: mockHabit.name,
          targetFrequency: mockHabit.frequency,
        },
        expect.any(Object)
      );
      expect(mockBehavioralAgent).not.toHaveBeenCalled();
      expect(result.aiAgentType).toBe("language-teacher");
    });

    it("calls behavioral agent for tracking-coached habits", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue({ ...mockHabit, targetSkill: "fitness" });
      userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      journalRepo.update.mockResolvedValue(mockJournalEntry);
      userProfilesRepo.upsert.mockResolvedValue(undefined);
      mockBehavioralAgent.mockResolvedValue({
        agentType: "behavioral-coach",
        targetSkill: "fitness",
        behavioral: { moodDetected: "motivated", energyLevel: "high" },
        habitAlignmentScore: 85,
        insights: ["Great progress"],
        actionSuggestion: "Keep going",
      } as never);

      const result = await service.analyze(
        { journalEntryId: "journal-entry-id-1", habitId: "habit-id-1" },
        "user-id-1"
      );

      expect(mockBehavioralAgent).toHaveBeenCalledWith(
        {
          targetSkill: "fitness",
          uiLanguage: "pt-BR",
          journalContent: mockJournalEntry.content,
          habitName: mockHabit.name,
          targetFrequency: mockHabit.frequency,
        },
        expect.any(Object)
      );
      expect(mockLanguageAgent).not.toHaveBeenCalled();
      expect(result.aiAgentType).toBe("behavioral-coach");
    });

    it("resets count when last request was on a different day", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue({ ...mockHabit, targetSkill: "en-US" });
      userProfilesRepo.findByUserId.mockResolvedValue({
        ...mockProfile,
        aiRequestsToday: 5,
        lastAiRequest: new Date("2026-03-10"),
      });
      journalRepo.update.mockResolvedValue(mockJournalEntry);
      userProfilesRepo.upsert.mockResolvedValue(undefined);
      mockLanguageAgent.mockResolvedValue({
        agentType: "language-teacher",
        targetSkill: "en-US",
        linguistic: { grammarScore: 85, vocabularyScore: 90, fluencyScore: 80 },
        errors: [],
        modelSentence: "Great job!",
        nextChallenge: "Practice more",
      } as never);

      const result = await service.analyze(
        { journalEntryId: "journal-entry-id-1", habitId: "habit-id-1" },
        "user-id-1"
      );

      expect(result.aiAgentType).toBe("language-teacher");
    });

    it("saves AI feedback to journal entry", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue({ ...mockHabit, targetSkill: "en-US" });
      userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      const updatedEntry = { ...mockJournalEntry, aiFeedback: { test: "data" } };
      journalRepo.update.mockResolvedValue(updatedEntry);
      userProfilesRepo.upsert.mockResolvedValue(undefined);
      mockLanguageAgent.mockResolvedValue({
        agentType: "language-teacher",
        targetSkill: "en-US",
        linguistic: { grammarScore: 85, vocabularyScore: 90, fluencyScore: 80 },
        errors: [],
        modelSentence: "Great job!",
        nextChallenge: "Practice more",
      } as never);

      await service.analyze(
        { journalEntryId: "journal-entry-id-1", habitId: "habit-id-1" },
        "user-id-1"
      );

      expect(journalRepo.update).toHaveBeenCalledWith(
        "journal-entry-id-1",
        "user-id-1",
        expect.objectContaining({
          aiFeedback: expect.any(Object),
          aiAgentType: "language-teacher",
        })
      );
    });

    it("increments AI request count", async () => {
      const { service, journalRepo, habitsRepo, userProfilesRepo } = makeService();
      journalRepo.findById.mockResolvedValue(mockJournalEntry);
      habitsRepo.findById.mockResolvedValue({ ...mockHabit, targetSkill: "en-US" });
      userProfilesRepo.findByUserId.mockResolvedValue(mockProfile);
      journalRepo.update.mockResolvedValue(mockJournalEntry);
      userProfilesRepo.upsert.mockResolvedValue(undefined);
      mockLanguageAgent.mockResolvedValue({
        agentType: "language-teacher",
        targetSkill: "en-US",
        linguistic: { grammarScore: 85, vocabularyScore: 90, fluencyScore: 80 },
        errors: [],
        modelSentence: "Great job!",
        nextChallenge: "Practice more",
      } as never);

      await service.analyze(
        { journalEntryId: "journal-entry-id-1", habitId: "habit-id-1" },
        "user-id-1"
      );

      expect(userProfilesRepo.upsert).toHaveBeenCalledWith(
        "user-id-1",
        expect.objectContaining({
          aiRequestsToday: 3,
          lastAiRequest: expect.any(Date),
        })
      );
    });
  });
});
