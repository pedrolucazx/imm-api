import { z } from "zod";

export const ALLOWED_FREQUENCIES = ["daily", "weekly"] as const;
export type HabitFrequency = (typeof ALLOWED_FREQUENCIES)[number];

export const createHabitSchema = z.object({
  name: z.string().min(1).max(255),
  targetSkill: z.string().max(100).optional(),
  icon: z.string().min(1).max(50),
  color: z.string().min(1).max(20),
  frequency: z.enum(ALLOWED_FREQUENCIES).default("daily"),
  targetDays: z.number().int().min(1).max(7).default(7),
  sortOrder: z.number().int().optional(),
  startDate: z.string().optional(),
});

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  targetSkill: z.string().max(100).optional(),
  icon: z.string().min(1).max(50).optional(),
  color: z.string().min(1).max(20).optional(),
  frequency: z.enum(ALLOWED_FREQUENCIES).optional(),
  targetDays: z.number().int().min(1).max(7).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const checkInSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "logDate must be YYYY-MM-DD"),
  completed: z.boolean(),
});

export const plannerWizardSchema = z.object({
  painPoints: z.array(z.string().min(1)).min(1),
  availableMinutes: z.number().int().positive(),
  level: z.enum(["beginner", "intermediate", "advanced"]),
});

export const createWithPlanSchema = createHabitSchema.merge(plannerWizardSchema);

export const regeneratePlanSchema = plannerWizardSchema;

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CreateWithPlanInput = z.infer<typeof createWithPlanSchema>;
export type RegeneratePlanInput = z.infer<typeof regeneratePlanSchema>;
