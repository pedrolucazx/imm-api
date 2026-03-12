import type { HabitsRepository } from "./habits.repository.js";
import type { HabitLogsRepository } from "./habit-logs.repository.js";
import type { Habit, HabitLog } from "../../core/database/schema/index.js";
import { NotFoundError, ForbiddenError, UnprocessableError } from "../../shared/errors/index.js";
import { deriveHabitMode } from "../../shared/schemas/habit-mode.js";
import type { CreateHabitInput, UpdateHabitInput, CheckInInput } from "./habits.types.js";

export const MAX_ACTIVE_HABITS = 10;

type HabitsServiceDeps = {
  habitsRepo: HabitsRepository;
  habitLogsRepo: HabitLogsRepository;
};

export function createHabitsService({ habitsRepo, habitLogsRepo }: HabitsServiceDeps) {
  return {
    async list(userId: string): Promise<Habit[]> {
      return habitsRepo.findAllByUserId(userId);
    },

    async getById(userId: string, habitId: string): Promise<Habit> {
      const habit = await habitsRepo.findById(habitId);
      if (!habit) throw new NotFoundError("Habit not found");
      if (habit.userId !== userId) throw new ForbiddenError("Access denied");
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

    async update(userId: string, habitId: string, input: UpdateHabitInput): Promise<Habit> {
      const habit = await habitsRepo.findById(habitId);
      if (!habit) throw new NotFoundError("Habit not found");
      if (habit.userId !== userId) throw new ForbiddenError("Access denied");

      const updated = await habitsRepo.update(habitId, input);
      return updated ?? habit;
    },

    async remove(userId: string, habitId: string): Promise<void> {
      const habit = await habitsRepo.findById(habitId);
      if (!habit) throw new NotFoundError("Habit not found");
      if (habit.userId !== userId) throw new ForbiddenError("Access denied");
      await habitsRepo.softDelete(habitId);
    },

    async checkIn(userId: string, habitId: string, input: CheckInInput): Promise<HabitLog> {
      const habit = await habitsRepo.findById(habitId);
      if (!habit) throw new NotFoundError("Habit not found");
      if (habit.userId !== userId) throw new ForbiddenError("Access denied");
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
