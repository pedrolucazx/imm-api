import type { DrizzleDb } from "../../core/database/connection.js";
import { createJournalRepository } from "../journal/journal.repository.js";
import { createHabitsRepository } from "../habits/habits.repository.js";
import { createUserProfilesRepository } from "../users/user-profiles.repository.js";
import { deriveHabitMode, type TargetSkill } from "../../shared/schemas/habit-mode.js";
import { createOrchestrator } from "./orchestrator.js";
import { analyzeWithLanguageAgent } from "./language-agent.js";
import { analyzeWithBehavioralAgent } from "./behavioral-agent.js";
import { NotFoundError } from "../../shared/errors/index.js";
import type { LanguageAgentResponse } from "./language-agent.js";
import type { BehavioralAgentResponse } from "./behavioral-agent.js";
import type { JournalRepository } from "../journal/journal.repository.js";
import type { HabitsRepository } from "../habits/habits.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import { nextAiRequestCount } from "../../shared/utils/ai-rate-limit.js";
import { assertAiRateLimit } from "../../shared/guards/ai-rate-limit.guard.js";

export type AiAnalyzeInput = {
  journalEntryId: string;
  habitId: string;
};

export type AiAnalyzeOutput = {
  aiFeedback: LanguageAgentResponse | BehavioralAgentResponse;
  aiAgentType: "language-teacher" | "behavioral-coach";
};

export type AiServiceDeps = {
  journalRepo: JournalRepository;
  habitsRepo: HabitsRepository;
  userProfilesRepo: UserProfilesRepository;
};

export function createAiService(deps: AiServiceDeps) {
  const { journalRepo, habitsRepo, userProfilesRepo } = deps;
  const orchestrator = createOrchestrator({
    deriveHabitMode: (targetSkill: string) => deriveHabitMode(targetSkill as TargetSkill),
  });

  async function validateAndGetData(userId: string, input: AiAnalyzeInput) {
    const entry = await journalRepo.findById(input.journalEntryId, userId);
    if (!entry) {
      throw new NotFoundError("Journal entry not found");
    }

    if (entry.habitId !== input.habitId) {
      throw new NotFoundError("Habit does not belong to this journal entry");
    }

    const habit = await habitsRepo.findById(input.habitId, userId);
    if (!habit) {
      throw new NotFoundError("Habit not found");
    }

    const profile = await userProfilesRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("User profile not found");
    }

    return { entry, habit, profile };
  }

  async function checkAndIncrementRateLimit(profile: {
    userId: string;
    aiRequestsToday: number;
    lastAiRequest: Date | null;
  }) {
    const rateLimitProfile = {
      aiRequestsToday: profile.aiRequestsToday,
      lastAiRequest: profile.lastAiRequest,
    };

    assertAiRateLimit(rateLimitProfile);

    await userProfilesRepo.upsert(profile.userId, {
      aiRequestsToday: nextAiRequestCount(rateLimitProfile),
      lastAiRequest: new Date(),
    });
  }

  async function saveAiFeedback(
    entryId: string,
    userId: string,
    feedback: LanguageAgentResponse | BehavioralAgentResponse,
    agentType: "language-teacher" | "behavioral-coach"
  ) {
    await journalRepo.update(entryId, userId, {
      aiFeedback: feedback,
      aiAgentType: agentType,
    });
  }

  async function analyze(input: AiAnalyzeInput, userId: string): Promise<AiAnalyzeOutput> {
    const { entry, habit, profile } = await validateAndGetData(userId, input);

    await checkAndIncrementRateLimit(profile);

    const targetSkill = habit.targetSkill ?? "general";
    const agent = orchestrator.route(targetSkill);

    const serviceInput = {
      targetSkill,
      uiLanguage: profile.uiLanguage,
      journalContent: entry.content,
      habitName: habit.name,
      targetFrequency: habit.frequency,
    };

    let result: LanguageAgentResponse | BehavioralAgentResponse;

    if (agent.type === "language-teacher") {
      result = await analyzeWithLanguageAgent(serviceInput);
    } else {
      result = await analyzeWithBehavioralAgent(serviceInput);
    }

    await saveAiFeedback(entry.id, userId, result, agent.type);

    return {
      aiFeedback: result,
      aiAgentType: agent.type,
    };
  }

  return { analyze };
}

export function createAiServiceFromDb(db: DrizzleDb) {
  return createAiService({
    journalRepo: createJournalRepository(db),
    habitsRepo: createHabitsRepository(db),
    userProfilesRepo: createUserProfilesRepository(db),
  });
}

export type AiService = ReturnType<typeof createAiService>;
