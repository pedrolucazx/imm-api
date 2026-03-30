import { z } from "zod";

export const MAX_ONBOARDING_STEP = 5;

export const updateOnboardingSchema = z.object({
  currentStep: z.number().int().min(0).max(MAX_ONBOARDING_STEP).optional(),
  skipped: z.boolean().optional(),
  completed: z.boolean().optional(),
});

export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;

export interface OnboardingStatusResponse {
  currentStep: number;
  skipped: boolean;
  completed: boolean;
  completedAt: string | null;
}
