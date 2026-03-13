import type { HabitsRepository } from "./habits.repository.js";
import type { HabitLogsRepository } from "./habit-logs.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import type { Habit, HabitLog } from "../../core/database/schema/index.js";
import {
  NotFoundError,
  TooManyRequestsError,
  UnprocessableError,
} from "../../shared/errors/index.js";
import { deriveHabitMode } from "../../shared/schemas/habit-mode.js";
import type {
  CheckInInput,
  CreateHabitInput,
  CreateWithPlanInput,
  RegeneratePlanInput,
  UpdateHabitInput,
} from "./habits.types.js";
import { generateHabitPlan } from "./habit-planner.js";

export const MAX_ACTIVE_HABITS = 5;
const AI_RATE_LIMIT_MS = 5000;

type HabitsServiceDeps = {
  habitsRepo: HabitsRepository;
  habitLogsRepo: HabitLogsRepository;
  userProfilesRepo: UserProfilesRepository;
};

export function createHabitsService({
  habitsRepo,
  habitLogsRepo,
  userProfilesRepo,
}: HabitsServiceDeps) {
  async function checkAiRateLimit(userId: string): Promise<void> {
    const profile = await userProfilesRepo.findByUserId(userId);
    if (profile?.lastAiRequest) {
      const elapsed = Date.now() - profile.lastAiRequest.getTime();
      if (elapsed < AI_RATE_LIMIT_MS) {
        throw new TooManyRequestsError("AI rate limit: wait 5 seconds between requests");
      }
    }
  }

  async function incrementAiUsage(userId: string): Promise<void> {
    const profile = await userProfilesRepo.findByUserId(userId);
    await userProfilesRepo.upsert(userId, {
      aiRequestsToday: (profile?.aiRequestsToday ?? 0) + 1,
      lastAiRequest: new Date(),
    });
  }

  return {
    async list(userId: string): Promise<Habit[]> {
      return habitsRepo.findAllByUserId(userId);
    },

    async getById(userId: string, habitId: string): Promise<Habit> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");
      return habit;
    },

    async create(userId: string, input: CreateHabitInput): Promise<Habit> {
      const activeCount = await habitsRepo.countActiveByUserId(userId);
      if (activeCount >= MAX_ACTIVE_HABITS) {
        throw new UnprocessableError(`Limit of ${MAX_ACTIVE_HABITS} active habits reached`);
      }

      const mode = deriveHabitMode(
        (input.targetSkill as Parameters<typeof deriveHabitMode>[0]) ?? "general"
      );

      return habitsRepo.create({
        ...input,
        userId,
        planStatus: mode === "skill-building" ? "active" : "inactive",
      });
    },

    async createWithPlan(userId: string, input: CreateWithPlanInput): Promise<Habit> {
      await checkAiRateLimit(userId);

      const activeCount = await habitsRepo.countActiveByUserId(userId);
      if (activeCount >= MAX_ACTIVE_HABITS) {
        throw new UnprocessableError(`Limit of ${MAX_ACTIVE_HABITS} active habits reached`);
      }

      const { painPoints, availableMinutes, level, ...habitInput } = input;
      const mode = deriveHabitMode(
        (habitInput.targetSkill as Parameters<typeof deriveHabitMode>[0]) ?? "general"
      );

      const habit = await habitsRepo.create({
        ...habitInput,
        userId,
        planStatus: "generating",
      });

      await incrementAiUsage(userId);

      try {
        const plan = await generateHabitPlan(
          {
            name: habit.name,
            targetSkill: habit.targetSkill ?? undefined,
            painPoints,
            availableMinutes,
            level,
          },
          mode
        );
        return (
          (await habitsRepo.update(habit.id, userId, { habitPlan: plan, planStatus: "ready" })) ??
          habit
        );
      } catch {
        return (await habitsRepo.update(habit.id, userId, { planStatus: "failed" })) ?? habit;
      }
    },

    async regeneratePlan(
      userId: string,
      habitId: string,
      input: RegeneratePlanInput
    ): Promise<Habit> {
      await checkAiRateLimit(userId);

      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");
      if (habit.planStatus === "generating") {
        throw new UnprocessableError("Plan is already being generated");
      }

      const mode = deriveHabitMode(
        (habit.targetSkill as Parameters<typeof deriveHabitMode>[0]) ?? "general"
      );

      await habitsRepo.update(habitId, userId, { planStatus: "generating" });
      await incrementAiUsage(userId);

      const { painPoints, availableMinutes, level } = input;
      try {
        const plan = await generateHabitPlan(
          {
            name: habit.name,
            targetSkill: habit.targetSkill ?? undefined,
            painPoints,
            availableMinutes,
            level,
          },
          mode
        );
        return (
          (await habitsRepo.update(habitId, userId, { habitPlan: plan, planStatus: "ready" })) ??
          habit
        );
      } catch {
        return (await habitsRepo.update(habitId, userId, { planStatus: "failed" })) ?? habit;
      }
    },

    async update(userId: string, habitId: string, input: UpdateHabitInput): Promise<Habit> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");

      const updated = await habitsRepo.update(habitId, userId, input);
      return updated ?? habit;
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
