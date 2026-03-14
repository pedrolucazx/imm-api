import { env } from "../../core/config/env.js";
import { habitPlanSchema, type HabitPlan } from "./habit-plan.schema.js";
import type { HabitMode } from "../../shared/schemas/habit-mode.js";
import { TooManyRequestsError } from "../../shared/errors/index.js";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

type PlannerInput = {
  name: string;
  targetSkill?: string;
  painPoints: string[];
  availableMinutes: number;
  level: string;
  uiLanguage?: string;
};

function langInstruction(uiLanguage: string): string {
  return `IMPORTANT: Write ALL text fields in the language with code "${uiLanguage}" (e.g. pt-BR = Brazilian Portuguese, en-US = English, es-ES = Spanish).`;
}

function buildFullTemplate(input: PlannerInput): string {
  return `You are a habit coach creating a 66-day skill-building plan.
${langInstruction(input.uiLanguage ?? "pt-BR")}

Habit: "${input.name}"
Target skill: ${input.targetSkill ?? "general"}
Pain points: ${input.painPoints.join(", ")}
Available minutes per day: ${input.availableMinutes}
Level: ${input.level}

Generate a 66-day skill-building plan with EXACTLY 3 phases. Be extremely concise. Return ONLY valid JSON:
{
  "schema_version": 2,
  "plan_type": "full",
  "strategy": "short strategy (max 10 words)",
  "phases": [
    { "phase": 1, "days": "1-22", "theme": "short theme", "daily_tasks": ["task1 (max 6 words)", "task2 (max 6 words)"] },
    { "phase": 2, "days": "23-44", "theme": "short theme", "daily_tasks": ["task1", "task2"] },
    { "phase": 3, "days": "45-66", "theme": "short theme", "daily_tasks": ["task1", "task2"] }
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
Level: ${input.level}

Generate a lightweight 66-day consistency plan with EXACTLY 3 phases. Be extremely concise. Return ONLY valid JSON:
{
  "schema_version": 2,
  "plan_type": "light",
  "strategy": "short strategy (max 10 words)",
  "phases": [
    { "phase": 1, "days": "1-22", "theme": "short theme", "weekly_focus": "focus (max 8 words)", "tip": "tip (max 8 words)" },
    { "phase": 2, "days": "23-44", "theme": "short theme", "weekly_focus": "focus", "tip": "tip" },
    { "phase": 3, "days": "45-66", "theme": "short theme", "weekly_focus": "focus", "tip": "tip" }
  ],
  "total_time_per_day_minutes": ${input.availableMinutes},
  "success_metrics": "66 consecutive days completed"
}

IMPORTANT: Output must be complete, valid JSON only. No markdown.`;
}

const GEMINI_TIMEOUT_MS = 30_000;
const GEMINI_MAX_RETRIES = 3;
const GEMINI_RETRY_BASE_MS = 5_000;

export class GeminiRateLimitError extends TooManyRequestsError {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRateLimitError";
  }
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
        },
        required: ["phase", "days", "theme", "daily_tasks"],
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
        },
        required: ["phase", "days", "theme", "weekly_focus", "tip"],
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

async function callGeminiOnce(
  apiKey: string,
  prompt: string,
  maxOutputTokens: number,
  isFull: boolean
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: isFull ? FULL_PLAN_RESPONSE_SCHEMA : LIGHT_PLAN_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini API timeout after ${GEMINI_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new GeminiRateLimitError(
      `Gemini API rate limit: ${response.status} ${response.statusText}`
    );
  }

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

async function callGemini(
  prompt: string,
  maxOutputTokens: number,
  isFull: boolean
): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  let lastError: unknown;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(apiKey, prompt, maxOutputTokens, isFull);
    } catch (error) {
      if (error instanceof GeminiRateLimitError) {
        lastError = error;
        if (attempt < GEMINI_MAX_RETRIES) {
          const delay = GEMINI_RETRY_BASE_MS * 2 ** attempt;
          // eslint-disable-next-line no-console
          console.warn(
            `[habit-planner] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${GEMINI_MAX_RETRIES})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw lastError;
}

function sanitizeJsonString(text: string): string {
  let cleaned = text.replace(/^```json\n?|\n?```$/g, "").trim();
  cleaned = cleaned.replace(/^```\n?|\n?```$/g, "").trim();

  cleaned = cleaned.replace(/: '([\s\S]*?)'(?=[,}\]])/g, ': "$1"');

  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  cleaned = cleaned.replace(/"\s+/g, '" ').replace(/\s+"/g, ' "');

  return cleaned;
}

export async function generateHabitPlan(input: PlannerInput, mode: HabitMode): Promise<HabitPlan> {
  const isFull = mode === "skill-building";
  const prompt = isFull ? buildFullTemplate(input) : buildLightTemplate(input);
  const maxOutputTokens = isFull ? 8192 : 4096;

  const rawText = await callGemini(prompt, maxOutputTokens, isFull);
  let parsed: unknown;
  try {
    const sanitized = sanitizeJsonString(rawText);
    parsed = JSON.parse(sanitized);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "[habit-planner] JSON.parse failed. rawText length:",
      rawText.length,
      "tail:",
      rawText.slice(-200)
    );
    throw e;
  }
  return habitPlanSchema.parse(parsed);
}
