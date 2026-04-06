import { habitPlanSchema, type HabitPlan } from "./habit-plan.schema.js";
import type { HabitMode } from "../../shared/schemas/habit-mode.js";
import { logger } from "../../core/config/logger.js";
import { sanitizeJsonString } from "../../shared/utils/json.js";
import { langInstruction } from "../../shared/utils/ai-prompt.js";
import type { TextAIProvider } from "../../core/ai/text-ai.interface.js";

type PlannerInput = {
  name: string;
  targetSkill?: string;
  painPoints: string[];
  availableMinutes: number;
  level: string;
  uiLanguage?: string;
  feedbackOnPlan?: string;
};

function buildFullTemplate(input: PlannerInput): string {
  return `You are a habit coach creating a 66-day skill-building plan.
${langInstruction(input.uiLanguage ?? "pt-BR")}

Habit: "${input.name}"
Target skill: ${input.targetSkill ?? "general"}
Pain points: ${input.painPoints.join(", ")}
Available minutes per day: ${input.availableMinutes}
Level: ${input.level}${input.feedbackOnPlan ? `\nUser feedback on previous plan: ${input.feedbackOnPlan}` : ""}

Generate a 66-day skill-building plan with EXACTLY 3 phases. Be extremely concise. Return ONLY valid JSON:
{
  "schema_version": 2,
  "plan_type": "full",
  "strategy": "short strategy (max 10 words)",
  "phases": [
    { "phase": 1, "days": "1-22", "theme": "short theme", "daily_tasks": ["task1 (max 6 words)", "task2 (max 6 words)"], "journal_prompt": "question guiding today's reflection for this phase (max 15 words)" },
    { "phase": 2, "days": "23-44", "theme": "short theme", "daily_tasks": ["task1", "task2"], "journal_prompt": "question guiding today's reflection for this phase (max 15 words)" },
    { "phase": 3, "days": "45-66", "theme": "short theme", "daily_tasks": ["task1", "task2"], "journal_prompt": "question guiding today's reflection for this phase (max 15 words)" }
  ],
  "total_time_per_day_minutes": ${input.availableMinutes},
  "success_metrics": "short metric (max 10 words)"
}

IMPORTANT: Output must be complete, valid JSON only. No markdown.`;
}

function buildLightTemplate(input: PlannerInput): string {
  return `You are a habit coach creating a 66-day consistency plan.
${langInstruction(input.uiLanguage ?? "pt-BR")}

Habit: "${input.name}"
Pain points: ${input.painPoints.join(", ")}
Available minutes per day: ${input.availableMinutes}
Level: ${input.level}${input.feedbackOnPlan ? `\nUser feedback on previous plan: ${input.feedbackOnPlan}` : ""}

Generate a lightweight 66-day consistency plan with EXACTLY 3 phases. Be extremely concise. Return ONLY valid JSON:
{
  "schema_version": 2,
  "plan_type": "light",
  "strategy": "short strategy (max 10 words)",
  "phases": [
    { "phase": 1, "days": "1-22", "theme": "short theme", "weekly_focus": "focus (max 8 words)", "tip": "tip (max 8 words)", "journal_prompt": "question guiding today's reflection for this phase (max 15 words)" },
    { "phase": 2, "days": "23-44", "theme": "short theme", "weekly_focus": "focus", "tip": "tip", "journal_prompt": "question guiding today's reflection for this phase (max 15 words)" },
    { "phase": 3, "days": "45-66", "theme": "short theme", "weekly_focus": "focus", "tip": "tip", "journal_prompt": "question guiding today's reflection for this phase (max 15 words)" }
  ],
  "total_time_per_day_minutes": ${input.availableMinutes},
  "success_metrics": "66 consecutive days completed"
}

IMPORTANT: Output must be complete, valid JSON only. No markdown.`;
}

const FULL_PLAN_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    schema_version: { type: "number" },
    plan_type: { type: "string" },
    strategy: { type: "string" },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "number" },
          days: { type: "string" },
          theme: { type: "string" },
          daily_tasks: { type: "array", items: { type: "string" } },
          journal_prompt: { type: "string" },
        },
        required: ["phase", "days", "theme", "daily_tasks", "journal_prompt"],
      },
    },
    total_time_per_day_minutes: { type: "number" },
    success_metrics: { type: "string" },
  },
  required: [
    "schema_version",
    "plan_type",
    "strategy",
    "phases",
    "total_time_per_day_minutes",
    "success_metrics",
  ],
};

const LIGHT_PLAN_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    schema_version: { type: "number" },
    plan_type: { type: "string" },
    strategy: { type: "string" },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "number" },
          days: { type: "string" },
          theme: { type: "string" },
          weekly_focus: { type: "string" },
          tip: { type: "string" },
          journal_prompt: { type: "string" },
        },
        required: ["phase", "days", "theme", "weekly_focus", "tip", "journal_prompt"],
      },
    },
    total_time_per_day_minutes: { type: "number" },
    success_metrics: { type: "string" },
  },
  required: [
    "schema_version",
    "plan_type",
    "strategy",
    "phases",
    "total_time_per_day_minutes",
    "success_metrics",
  ],
};

export async function generateHabitPlan(
  input: PlannerInput,
  mode: HabitMode,
  textAI: TextAIProvider
): Promise<HabitPlan> {
  const isFull = mode === "skill-building";
  const prompt = isFull ? buildFullTemplate(input) : buildLightTemplate(input);
  const maxOutputTokens = isFull ? 8192 : 4096;
  const responseSchema = isFull ? FULL_PLAN_RESPONSE_SCHEMA : LIGHT_PLAN_RESPONSE_SCHEMA;

  const rawText = await textAI.generate(prompt, maxOutputTokens, {
    responseSchema,
    temperature: 0.4,
  });

  let parsed: unknown;
  try {
    const sanitized = sanitizeJsonString(rawText);
    parsed = JSON.parse(sanitized);
  } catch (e) {
    logger.error({ rawTextLength: rawText.length }, "[habit-planner] JSON.parse failed");
    throw e;
  }
  return habitPlanSchema.parse(parsed);
}
