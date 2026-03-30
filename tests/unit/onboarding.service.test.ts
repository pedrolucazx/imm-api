import { createOnboardingService } from "../../src/modules/users/onboarding.service.js";
import type { OnboardingRepository } from "../../src/modules/users/onboarding.repository.js";
import type { OnboardingSession } from "../../src/core/database/schema/index.js";

const mockSession: OnboardingSession = {
  id: "session-uuid-1",
  userId: "user-uuid-1",
  currentStep: 0,
  skipped: false,
  completed: false,
  completedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function makeRepo(overrides: Partial<jest.Mocked<OnboardingRepository>> = {}) {
  const repo: jest.Mocked<OnboardingRepository> = {
    findByUserId: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    ...overrides,
  };
  return repo;
}

describe("onboardingService.getStatus", () => {
  it("returns default status when no session exists", async () => {
    const repo = makeRepo({ findByUserId: jest.fn().mockResolvedValue(undefined) });
    const service = createOnboardingService({ repo });

    const result = await service.getStatus("user-uuid-1");

    expect(result).toEqual({ currentStep: 0, skipped: false, completed: false, completedAt: null });
  });

  it("returns session data when session exists", async () => {
    const session = { ...mockSession, currentStep: 3, skipped: true };
    const repo = makeRepo({ findByUserId: jest.fn().mockResolvedValue(session) });
    const service = createOnboardingService({ repo });

    const result = await service.getStatus("user-uuid-1");

    expect(result).toEqual({
      currentStep: 3,
      skipped: true,
      completed: false,
      completedAt: null,
    });
  });

  it("formats completedAt as ISO string when present", async () => {
    const completedAt = new Date("2026-03-01T12:00:00Z");
    const session = { ...mockSession, completed: true, completedAt };
    const repo = makeRepo({ findByUserId: jest.fn().mockResolvedValue(session) });
    const service = createOnboardingService({ repo });

    const result = await service.getStatus("user-uuid-1");

    expect(result.completedAt).toBe("2026-03-01T12:00:00.000Z");
  });
});

describe("onboardingService.update", () => {
  it("sets completedAt to current date when completed becomes true", async () => {
    const repo = makeRepo({
      upsert: jest
        .fn()
        .mockResolvedValue({ ...mockSession, completed: true, completedAt: new Date() }),
    });
    const service = createOnboardingService({ repo });

    await service.update("user-uuid-1", { completed: true });

    expect(repo.upsert).toHaveBeenCalledWith(
      "user-uuid-1",
      expect.objectContaining({ completed: true, completedAt: expect.any(Date) })
    );
  });

  it("sets completedAt to null when completed becomes false", async () => {
    const repo = makeRepo({ upsert: jest.fn().mockResolvedValue(mockSession) });
    const service = createOnboardingService({ repo });

    await service.update("user-uuid-1", { completed: false });

    expect(repo.upsert).toHaveBeenCalledWith(
      "user-uuid-1",
      expect.objectContaining({ completed: false, completedAt: null })
    );
  });

  it("omits completedAt when completed is not provided", async () => {
    const repo = makeRepo({ upsert: jest.fn().mockResolvedValue(mockSession) });
    const service = createOnboardingService({ repo });

    await service.update("user-uuid-1", { currentStep: 2 });

    const call = repo.upsert.mock.calls[0][1];
    expect(call).not.toHaveProperty("completedAt");
    expect(call.currentStep).toBe(2);
  });

  it("passes only provided fields to upsert", async () => {
    const repo = makeRepo({ upsert: jest.fn().mockResolvedValue(mockSession) });
    const service = createOnboardingService({ repo });

    await service.update("user-uuid-1", { skipped: true });

    const call = repo.upsert.mock.calls[0][1];
    expect(call).toEqual({ skipped: true });
  });
});
