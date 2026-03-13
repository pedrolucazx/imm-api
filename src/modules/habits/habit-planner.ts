import { env } from "../../core/config/env.js";
import { habitPlanSchema, type HabitPlan } from "./habit-plan.schema.js";
import type { HabitMode } from "../../shared/schemas/habit-mode.js";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

type PlannerInput = {
  name: string;
  targetSkill?: string;
  painPoints: string[];
  availableMinutes: number;
  level: string;
};

function buildFullTemplate(input: PlannerInput): string {
  return `You are a habit coach creating a 66-day skill-building plan.

Habit: "${input.name}"
Target skill: ${input.targetSkill ?? "general"}
Pain points: ${input.painPoints.join(", ")}
Available minutes per day: ${input.availableMinutes}
Level: ${input.level}

Generate a 66-day plan divided into phases of ~14 days each. Return ONLY valid JSON matching this exact schema:
{
  "schema_version": 2,
  "plan_type": "full",
  "strategy": "<brief strategy description>",
  "phases": [
    {
      "phase": 1,
      "days": "1-14",
      "theme": "<phase theme>",
      "daily_tasks": ["<task1>", "<task2>"],
      "techniques": ["<technique1>", "<technique2>"]
    }
  ],
  "total_time_per_day_minutes": ${input.availableMinutes},
  "success_metrics": "<measurable success criteria>"
}

Return only the JSON object, no markdown, no explanation.`;
}

function buildLightTemplate(input: PlannerInput): string {
  return `You are a habit coach creating a 66-day consistency plan.

Habit: "${input.name}"
Pain points: ${input.painPoints.join(", ")}
Available minutes per day: ${input.availableMinutes}
Level: ${input.level}

Generate a lightweight 66-day consistency plan divided into phases of ~14 days. Return ONLY valid JSON matching this exact schema:
{
  "schema_version": 2,
  "plan_type": "light",
  "strategy": "Consistency Anchoring",
  "phases": [
    {
      "phase": 1,
      "days": "1-14",
      "theme": "<phase theme>",
      "weekly_focus": "<focus for the week>",
      "tip": "<motivational tip>"
    }
  ],
  "success_metrics": "66 dias consecutivos"
}

Return only the JSON object, no markdown, no explanation.`;
}

async function callGemini(prompt: string, maxOutputTokens: number): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");

  return text;
}

export async function generateHabitPlan(input: PlannerInput, mode: HabitMode): Promise<HabitPlan> {
  const isFull = mode === "skill-building";
  const prompt = isFull ? buildFullTemplate(input) : buildLightTemplate(input);
  const maxOutputTokens = isFull ? 800 : 500;

  const rawText = await callGemini(prompt, maxOutputTokens);
  const parsed = JSON.parse(rawText) as unknown;
  return habitPlanSchema.parse(parsed);
}
