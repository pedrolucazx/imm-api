import { z } from "zod";

export const updateOnboardingSchema = z.object({
  currentStep: z.number().int().min(0).max(5).optional(),
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
