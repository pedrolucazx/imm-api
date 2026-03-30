import type { OnboardingRepository } from "./onboarding.repository.js";
import type { UpdateOnboardingInput, OnboardingStatusResponse } from "./onboarding.types.js";

const DEFAULT_STATUS = {
  currentStep: 0,
  skipped: false,
  completed: false,
  completedAt: null,
} as const satisfies OnboardingStatusResponse;

function toResponse(session: {
  currentStep: number;
  skipped: boolean;
  completed: boolean;
  completedAt: Date | null;
}): OnboardingStatusResponse {
  return {
    currentStep: session.currentStep,
    skipped: session.skipped,
    completed: session.completed,
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
  };
}

export function createOnboardingService({ repo }: { repo: OnboardingRepository }) {
  return {
    async getStatus(userId: string): Promise<OnboardingStatusResponse> {
      const session = await repo.findByUserId(userId);
      if (!session) return DEFAULT_STATUS;
      return toResponse(session);
    },

    async update(userId: string, input: UpdateOnboardingInput): Promise<OnboardingStatusResponse> {
      const completedAt =
        input.completed === true ? new Date() : input.completed === false ? null : undefined;

      const data: Parameters<OnboardingRepository["upsert"]>[1] = {};
      if (input.currentStep !== undefined) data.currentStep = input.currentStep;
      if (input.skipped !== undefined) data.skipped = input.skipped;
      if (input.completed !== undefined) data.completed = input.completed;
      if (completedAt !== undefined) data.completedAt = completedAt;

      const session = await repo.upsert(userId, data);
      return toResponse(session);
    },
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
