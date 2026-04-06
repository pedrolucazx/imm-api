import type { HabitsRepository } from "./habits.repository.js";
import type { HabitLogsRepository } from "./habit-logs.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import type { Habit, HabitLog } from "../../core/database/schema/index.js";
import { logger } from "../../core/config/logger.js";
import {
  AppError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnprocessableError,
} from "../../shared/errors/index.js";
import { deriveHabitMode } from "../../shared/schemas/habit-mode.js";
import type {
  CheckInInput,
  CreateHabitInput,
  CreateWithPlanInput,
  PreviewPlanInput,
  RegeneratePlanInput,
  UpdateHabitInput,
} from "./habits.types.js";
import { generateHabitPlan } from "./habit-planner.js";
import type { HabitPlan } from "./habit-plan.schema.js";
import { MAX_ACTIVE_HABITS } from "../../shared/constants.js";
import { getTodayUTCString } from "../../shared/utils/date.js";
import { computeCurrentDay, computeStreak } from "../../shared/utils/habit-math.js";
import { nextAiRequestCount } from "../../shared/utils/ai-rate-limit.js";
import { assertAiRateLimit } from "../../shared/guards/ai-rate-limit.guard.js";
import { AIRateLimitError, AITemporaryError } from "../../core/ai/errors.js";
import type { TextAIProvider } from "../../core/ai/text-ai.interface.js";

export type HabitWithStats = Habit & {
  streak: number;
  currentDay: number;
  completedToday: boolean;
};

function enrichHabit(habit: Habit, logs: HabitLog[]): HabitWithStats {
  const todayStr = getTodayUTCString();
  return {
    ...habit,
    streak: computeStreak(logs),
    currentDay: computeCurrentDay(habit.startDate),
    completedToday: logs.some((l) => l.logDate === todayStr && l.completed),
  };
}

function toHabitPlannerError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof AIRateLimitError) {
    return new TooManyRequestsError("AI service is busy. Please wait a moment and try again.");
  }

  if (error instanceof AITemporaryError) {
    if (error.reason === "timeout") {
      return new ServiceUnavailableError("AI request timed out. Please try again.");
    }

    return new ServiceUnavailableError(
      "AI service is temporarily unavailable. Please try again in a moment."
    );
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("rate limit")) {
      return new TooManyRequestsError("AI service is busy. Please wait a moment and try again.");
    }

    if (normalizedMessage.includes("timeout")) {
      return new ServiceUnavailableError("AI request timed out. Please try again.");
    }

    if (normalizedMessage.includes("not configured")) {
      return new ServiceUnavailableError("AI service is not available at the moment.");
    }
  }

  return new ServiceUnavailableError(
    "AI service is temporarily unavailable. Please try again in a moment."
  );
}

type HabitsServiceDeps = {
  habitsRepo: HabitsRepository;
  habitLogsRepo: HabitLogsRepository;
  userProfilesRepo: UserProfilesRepository;
  textAI: TextAIProvider;
};

export function createHabitsService({
  habitsRepo,
  habitLogsRepo,
  userProfilesRepo,
  textAI,
}: HabitsServiceDeps) {
  async function checkAndIncrementAiUsage(userId: string): Promise<void> {
    const profile = await userProfilesRepo.findByUserId(userId);
    const rateLimitProfile = {
      aiRequestsToday: profile?.aiRequestsToday ?? 0,
      lastAiRequest: profile?.lastAiRequest ?? null,
      timezone: profile?.timezone ?? "UTC",
    };

    assertAiRateLimit(rateLimitProfile);

    await userProfilesRepo.upsert(userId, {
      aiRequestsToday: nextAiRequestCount(rateLimitProfile),
      lastAiRequest: new Date(),
    });
  }

  return {
    async list(userId: string): Promise<HabitWithStats[]> {
      const habits = await habitsRepo.findAllByUserId(userId);
      if (habits.length === 0) return [];
      const allLogs = await habitLogsRepo.findAllByHabitIds(habits.map((h) => h.id));
      const logsByHabit = new Map<string, HabitLog[]>();
      for (const log of allLogs) {
        const arr = logsByHabit.get(log.habitId) ?? [];
        arr.push(log);
        logsByHabit.set(log.habitId, arr);
      }
      return habits.map((h) => enrichHabit(h, logsByHabit.get(h.id) ?? []));
    },

    async getById(userId: string, habitId: string): Promise<HabitWithStats> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");
      const logs = await habitLogsRepo.findByHabitId(habitId);
      return enrichHabit(habit, logs);
    },

    async previewPlan(userId: string, input: PreviewPlanInput): Promise<HabitPlan> {
      await checkAndIncrementAiUsage(userId);
      const profile = await userProfilesRepo.findByUserId(userId);
      const mode = deriveHabitMode(
        (input.targetSkill as Parameters<typeof deriveHabitMode>[0]) ?? "general"
      );
      const uiLanguage = profile?.uiLanguage ?? "pt-BR";
      try {
        return await generateHabitPlan(
          {
            name: input.name,
            targetSkill: input.targetSkill ?? undefined,
            painPoints: input.painPoints,
            availableMinutes: input.availableMinutes,
            level: input.level,
            uiLanguage,
            feedbackOnPlan: input.feedbackOnPlan ?? undefined,
          },
          mode,
          textAI
        );
      } catch (err) {
        logger.error({ err }, "[habit-planner] previewPlan failed");
        throw toHabitPlannerError(err);
      }
    },

    async create(userId: string, input: CreateHabitInput): Promise<HabitWithStats> {
      const activeCount = await habitsRepo.countActiveByUserId(userId);
      if (activeCount >= MAX_ACTIVE_HABITS) {
        throw new UnprocessableError(`Limit of ${MAX_ACTIVE_HABITS} active habits reached`);
      }

      const mode = deriveHabitMode(
        (input.targetSkill as Parameters<typeof deriveHabitMode>[0]) ?? "general"
      );

      let planStatus: string;
      if (input.habitPlan) {
        planStatus = "ready";
      } else if (mode === "skill-building") {
        planStatus = "active";
      } else {
        planStatus = "inactive";
      }

      const habit = await habitsRepo.create({
        startDate: getTodayUTCString(),
        ...input,
        userId,
        planStatus,
      });
      return enrichHabit(habit, []);
    },

    async createWithPlan(userId: string, input: CreateWithPlanInput): Promise<HabitWithStats> {
      await checkAndIncrementAiUsage(userId);

      const activeCount = await habitsRepo.countActiveByUserId(userId);
      if (activeCount >= MAX_ACTIVE_HABITS) {
        throw new UnprocessableError(`Limit of ${MAX_ACTIVE_HABITS} active habits reached`);
      }

      const { painPoints, availableMinutes, level, ...habitInput } = input;
      const mode = deriveHabitMode(
        (habitInput.targetSkill as Parameters<typeof deriveHabitMode>[0]) ?? "general"
      );
      const profile = await userProfilesRepo.findByUserId(userId);
      const uiLanguage = profile?.uiLanguage ?? "pt-BR";

      const habit = await habitsRepo.create({
        startDate: getTodayUTCString(),
        ...habitInput,
        userId,
        planStatus: "generating",
      });

      try {
        const plan = await generateHabitPlan(
          {
            name: habit.name,
            targetSkill: habit.targetSkill ?? undefined,
            painPoints,
            availableMinutes,
            level,
            uiLanguage,
          },
          mode,
          textAI
        );
        const updated =
          (await habitsRepo.update(habit.id, userId, { habitPlan: plan, planStatus: "ready" })) ??
          habit;
        return enrichHabit(updated, []);
      } catch (err) {
        const updated =
          (await habitsRepo.update(habit.id, userId, { planStatus: "failed" })) ?? habit;
        const plannerError = toHabitPlannerError(err);
        if (plannerError instanceof TooManyRequestsError) {
          // Suppress rate-limit after creation to avoid client retries duplicating habits.
          // Users can safely retry plan generation later through regeneratePlan.
          logger.warn({ err }, "[habit-planner] createWithPlan rate-limited after habit creation");
          return enrichHabit(updated, []);
        }
        logger.error({ err }, "[habit-planner] generateHabitPlan failed");
        return enrichHabit(updated, []);
      }
    },

    async regeneratePlan(
      userId: string,
      habitId: string,
      input: RegeneratePlanInput
    ): Promise<HabitWithStats> {
      await checkAndIncrementAiUsage(userId);

      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");
      if (habit.planStatus === "generating") {
        throw new UnprocessableError("Plan is already being generated");
      }

      const mode = deriveHabitMode(
        (habit.targetSkill as Parameters<typeof deriveHabitMode>[0]) ?? "general"
      );
      const profile = await userProfilesRepo.findByUserId(userId);
      const uiLanguage = profile?.uiLanguage ?? "pt-BR";

      await habitsRepo.update(habitId, userId, { planStatus: "generating" });

      const { painPoints, availableMinutes, level } = input;
      const logs = await habitLogsRepo.findAllByHabitIds([habitId]);
      try {
        const plan = await generateHabitPlan(
          {
            name: habit.name,
            targetSkill: habit.targetSkill ?? undefined,
            painPoints,
            availableMinutes,
            level,
            uiLanguage,
          },
          mode,
          textAI
        );
        const updated =
          (await habitsRepo.update(habitId, userId, { habitPlan: plan, planStatus: "ready" })) ??
          habit;
        return enrichHabit(updated, logs);
      } catch (err) {
        const updated =
          (await habitsRepo.update(habitId, userId, { planStatus: "failed" })) ?? habit;
        const plannerError = toHabitPlannerError(err);
        if (plannerError instanceof TooManyRequestsError) throw plannerError;
        logger.error({ err }, "[habit-planner] regeneratePlan failed");
        return enrichHabit(updated, logs);
      }
    },

    async update(
      userId: string,
      habitId: string,
      input: UpdateHabitInput
    ): Promise<HabitWithStats> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");

      const updated = (await habitsRepo.update(habitId, userId, input)) ?? habit;
      const logs = await habitLogsRepo.findByHabitId(habitId);
      return enrichHabit(updated, logs);
    },

    async remove(userId: string, habitId: string): Promise<void> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");
      await habitsRepo.softDelete(habitId, userId);
    },

    async checkIn(userId: string, habitId: string, input: CheckInInput): Promise<HabitLog> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");
      if (!habit.isActive) throw new UnprocessableError("Habit is not active");

      return habitLogsRepo.upsert({
        habitId,
        logDate: input.logDate,
        completed: input.completed,
        completedAt: input.completed ? new Date() : null,
      });
    },
  };
}

export type HabitsService = ReturnType<typeof createHabitsService>;
