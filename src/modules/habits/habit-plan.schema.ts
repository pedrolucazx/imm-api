import { z } from "zod";

const fullPhaseSchema = z.object({
  phase: z.number().int().positive(),
  days: z.string().min(1),
  theme: z.string().min(1),
  daily_tasks: z.array(z.string().trim().min(1)).min(1),
  techniques: z.array(z.string().trim().min(1)).min(1),
});

const lightPhaseSchema = z.object({
  phase: z.number().int().positive(),
  days: z.string().min(1),
  theme: z.string().min(1),
  weekly_focus: z.string().min(1),
  tip: z.string().min(1),
});

export const fullHabitPlanSchema = z.object({
  schema_version: z.literal(2),
  plan_type: z.literal("full"),
  strategy: z.string().min(1),
  phases: z.array(fullPhaseSchema).min(1),
  total_time_per_day_minutes: z.number().int().positive(),
  success_metrics: z.string().min(1),
});

export const lightHabitPlanSchema = z.object({
  schema_version: z.literal(2),
  plan_type: z.literal("light"),
  strategy: z.string().min(1),
  phases: z.array(lightPhaseSchema).min(1),
  success_metrics: z.literal("66 dias consecutivos"),
});

export const habitPlanSchema = z.discriminatedUnion("plan_type", [
  fullHabitPlanSchema,
  lightHabitPlanSchema,
]);

export type FullHabitPlan = z.infer<typeof fullHabitPlanSchema>;
export type LightHabitPlan = z.infer<typeof lightHabitPlanSchema>;
export type HabitPlan = z.infer<typeof habitPlanSchema>;
