import { createHabitsService } from "@/modules/habits/habits.service.js";
import { MAX_ACTIVE_HABITS } from "@/shared/constants.js";
import { NotFoundError, TooManyRequestsError, UnprocessableError } from "@/shared/errors/index.js";
import type { HabitsRepository } from "@/modules/habits/habits.repository.js";
import type { HabitLogsRepository } from "@/modules/habits/habit-logs.repository.js";
import type { UserProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import type { Habit } from "@/core/database/schema/index.js";

jest.mock("@/modules/habits/habit-planner.js", () => ({
  generateHabitPlan: jest.fn(),
}));

import { generateHabitPlan } from "@/modules/habits/habit-planner.js";
const mockGeneratePlan = generateHabitPlan as jest.MockedFunction<typeof generateHabitPlan>;

const FULL_PLAN = {
  schema_version: 2 as const,
  plan_type: "full" as const,
  strategy: "Progressive skill mastery",
  phases: [
    { phase: 1, days: "1-14", theme: "Foundation", daily_tasks: ["Task"], techniques: ["Tech"] },
  ],
  total_time_per_day_minutes: 30,
  success_metrics: "B1 in 66 days",
};

const mockHabit: Habit = {
  id: "habit-id-1",
  userId: "user-id-1",
  name: "Inglês",
  targetSkill: "en-US",
  icon: "🌍",
  color: "#4299e1",
  frequency: "daily",
  targetDays: 7,
  isActive: true,
  sortOrder: 0,
  startDate: null,
  habitPlan: {},
  planStatus: "generating",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRepos() {
  const habitsRepo = {
    create: jest.fn().mockResolvedValue(mockHabit),
    findById: jest.fn().mockResolvedValue(mockHabit),
    findAllByUserId: jest.fn().mockResolvedValue([]),
    countActiveByUserId: jest.fn().mockResolvedValue(0),
    update: jest
      .fn()
      .mockImplementation((_id, _userId, fields) => Promise.resolve({ ...mockHabit, ...fields })),
    softDelete: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<HabitsRepository>;

  const habitLogsRepo = {
    findAllByHabitIds: jest.fn().mockResolvedValue([]),
    findByHabitId: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue(undefined),
    findByHabitAndDate: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<HabitLogsRepository>;

  const userProfilesRepo = {
    findByUserId: jest.fn().mockResolvedValue({ aiRequestsToday: 0, lastAiRequest: null }),
    upsert: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<UserProfilesRepository>;

  return { habitsRepo, habitLogsRepo, userProfilesRepo };
}

const planInput = {
  name: "Inglês",
  targetSkill: "en-US",
  icon: "🌍",
  color: "#4299e1",
  frequency: "daily" as const,
  targetDays: 7,
  painPoints: ["pronuncia"],
  availableMinutes: 30,
  level: "beginner" as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createWithPlan", () => {
  it("creates habit and returns it with planStatus=ready on success", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    mockGeneratePlan.mockResolvedValue(FULL_PLAN);

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });
    const result = await service.createWithPlan("user-id-1", planInput);

    expect(habitsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ planStatus: "generating" })
    );
    expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
    expect(habitsRepo.update).toHaveBeenCalledWith(
      mockHabit.id,
      "user-id-1",
      expect.objectContaining({ planStatus: "ready", habitPlan: FULL_PLAN })
    );
    expect(result.planStatus).toBe("ready");
  });

  it("sets planStatus=failed when Gemini throws", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    mockGeneratePlan.mockRejectedValue(new Error("Gemini error"));

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });
    const result = await service.createWithPlan("user-id-1", planInput);

    expect(habitsRepo.update).toHaveBeenCalledWith(
      mockHabit.id,
      "user-id-1",
      expect.objectContaining({ planStatus: "failed" })
    );
    expect(result.planStatus).toBe("failed");
  });

  it("throws UnprocessableError when MAX_ACTIVE_HABITS reached", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    (habitsRepo.countActiveByUserId as jest.Mock).mockResolvedValue(MAX_ACTIVE_HABITS);

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });

    await expect(service.createWithPlan("user-id-1", planInput)).rejects.toThrow(
      UnprocessableError
    );
    expect(habitsRepo.create).not.toHaveBeenCalled();
  });

  it("throws TooManyRequestsError when AI rate limit not elapsed", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    (userProfilesRepo.findByUserId as jest.Mock).mockResolvedValue({
      aiRequestsToday: 1,
      lastAiRequest: new Date(), // now = within 5s
    });

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });

    await expect(service.createWithPlan("user-id-1", planInput)).rejects.toThrow(
      TooManyRequestsError
    );
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it("increments aiRequestsToday after Gemini call", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    mockGeneratePlan.mockResolvedValue(FULL_PLAN);

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });
    await service.createWithPlan("user-id-1", planInput);

    expect(userProfilesRepo.upsert).toHaveBeenCalledWith(
      "user-id-1",
      expect.objectContaining({ aiRequestsToday: 1 })
    );
  });
});

describe("regeneratePlan", () => {
  const regenInput = {
    painPoints: ["pronuncia"],
    availableMinutes: 30,
    level: "beginner" as const,
  };

  it("regenerates plan and returns habit with planStatus=ready", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    (habitsRepo.findById as jest.Mock).mockResolvedValue({ ...mockHabit, planStatus: "failed" });
    mockGeneratePlan.mockResolvedValue(FULL_PLAN);

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });
    const result = await service.regeneratePlan("user-id-1", "habit-id-1", regenInput);

    expect(habitsRepo.update).toHaveBeenCalledWith("habit-id-1", "user-id-1", {
      planStatus: "generating",
    });
    expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
    expect(result.planStatus).toBe("ready");
  });

  it("sets planStatus=failed when Gemini throws during regeneration", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    (habitsRepo.findById as jest.Mock).mockResolvedValue({ ...mockHabit, planStatus: "ready" });
    mockGeneratePlan.mockRejectedValue(new Error("parse error"));

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });
    const result = await service.regeneratePlan("user-id-1", "habit-id-1", regenInput);

    expect(result.planStatus).toBe("failed");
  });

  it("throws NotFoundError when habit does not exist", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    (habitsRepo.findById as jest.Mock).mockResolvedValue(null);

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });

    await expect(service.regeneratePlan("user-id-1", "habit-id-1", regenInput)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws UnprocessableError when planStatus is generating", async () => {
    const { habitsRepo, habitLogsRepo, userProfilesRepo } = makeRepos();
    (habitsRepo.findById as jest.Mock).mockResolvedValue({
      ...mockHabit,
      planStatus: "generating",
    });

    const service = createHabitsService({ habitsRepo, habitLogsRepo, userProfilesRepo });

    await expect(service.regeneratePlan("user-id-1", "habit-id-1", regenInput)).rejects.toThrow(
      UnprocessableError
    );
  });
});
