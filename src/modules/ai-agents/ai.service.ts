import type { DrizzleDb } from "../../core/database/connection.js";
import { createJournalRepository } from "../journal/journal.repository.js";
import { createHabitsRepository } from "../habits/habits.repository.js";
import { createUserProfilesRepository } from "../users/user-profiles.repository.js";
import { createAiAgentsModule } from "./ai-agents.module.js";
import { analyzeWithLanguageAgent } from "./language-agent.service.js";
import { analyzeWithBehavioralAgent } from "./behavioral-agent.service.js";
import { NotFoundError, ForbiddenError } from "../../shared/errors/index.js";
import type { LanguageAgentResponse } from "./agent-language.js";
import type { BehavioralAgentResponse } from "./agent-behavioral.js";
import type { JournalRepository } from "../journal/journal.repository.js";
import type { HabitsRepository } from "../habits/habits.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";

const MAX_AI_REQUESTS_PER_DAY = 10;

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
  const { orchestrator } = createAiAgentsModule();

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
    const now = new Date();
    const lastRequest = profile.lastAiRequest;

    const isSameDay =
      lastRequest &&
      lastRequest.getFullYear() === now.getFullYear() &&
      lastRequest.getMonth() === now.getMonth() &&
      lastRequest.getDate() === now.getDate();

    const currentCount = isSameDay ? profile.aiRequestsToday : 0;

    if (currentCount >= MAX_AI_REQUESTS_PER_DAY) {
      throw new ForbiddenError(`AI request limit of ${MAX_AI_REQUESTS_PER_DAY} per day exceeded`);
    }

    await userProfilesRepo.upsert(profile.userId, {
      aiRequestsToday: currentCount + 1,
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
