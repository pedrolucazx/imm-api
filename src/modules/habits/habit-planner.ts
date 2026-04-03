import { env } from "../../core/config/env.js";
import { habitPlanSchema, type HabitPlan } from "./habit-plan.schema.js";
import type { HabitMode } from "../../shared/schemas/habit-mode.js";
import { logger } from "../../core/config/logger.js";
import {
  GEMINI_TIMEOUT_MS,
  GEMINI_MAX_RETRIES,
  GEMINI_RETRY_BASE_MS,
} from "../../shared/constants.js";
import { sanitizeJsonString } from "../../shared/utils/json.js";
import { GeminiRateLimitError } from "../ai-agents/gemini-client.js";
import { langInstruction } from "../../shared/utils/ai-prompt.js";

export type GeminiTemporaryErrorReason = "timeout" | "network" | "upstream";

export class GeminiTemporaryError extends Error {
  readonly code = "GEMINI_TEMPORARY";

  constructor(
    message: string,
    readonly reason: GeminiTemporaryErrorReason
  ) {
    super(message);
    this.name = "GeminiTemporaryError";
  }
}

function getGeminiApiUrls(): string[] {
  return [...new Set([env.GEMINI_API_URL, ...env.GEMINI_API_FALLBACK_URLS])];
}

function isRetriableGeminiError(error: unknown): boolean {
  return error instanceof GeminiRateLimitError || error instanceof GeminiTemporaryError;
}

function isFailoverGeminiError(error: unknown): boolean {
  return error instanceof GeminiTemporaryError;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

async function callGeminiOnce(
  apiKey: string,
  apiUrl: string,
  prompt: string,
  maxOutputTokens: number,
  isFull: boolean
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(apiUrl, {
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
      throw new GeminiTemporaryError(`Gemini API timeout after ${GEMINI_TIMEOUT_MS}ms`, "timeout");
    }
    if (error instanceof TypeError || (error instanceof Error && error.message.includes("fetch"))) {
      throw new GeminiTemporaryError(
        `Gemini API request failed: ${getErrorMessage(error)}`,
        "network"
      );
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

  if ([502, 503, 504].includes(response.status)) {
    throw new GeminiTemporaryError(
      `Gemini API temporary error: ${response.status} ${response.statusText}`,
      "upstream"
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
  const apiUrls = getGeminiApiUrls();

  let lastError: unknown;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    for (let urlIndex = 0; urlIndex < apiUrls.length; urlIndex++) {
      const apiUrl = apiUrls[urlIndex];
      try {
        return await callGeminiOnce(apiKey, apiUrl, prompt, maxOutputTokens, isFull);
      } catch (error) {
        lastError = error;

        if (!isRetriableGeminiError(error)) {
          throw error;
        }

        if (!isFailoverGeminiError(error)) {
          break;
        }

        if (urlIndex < apiUrls.length - 1) {
          logger.warn(
            `[habit-planner] ${getErrorMessage(error)}; trying fallback Gemini endpoint ${urlIndex + 2}/${apiUrls.length}`
          );
        }
      }
    }

    if (attempt < GEMINI_MAX_RETRIES && isRetriableGeminiError(lastError)) {
      const delay = GEMINI_RETRY_BASE_MS * 2 ** attempt;
      logger.warn(
        `[habit-planner] ${getErrorMessage(lastError)}; retrying in ${delay}ms (attempt ${attempt + 1}/${GEMINI_MAX_RETRIES + 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    throw lastError;
  }

  // Defensive safeguard: the retry loop above should always exit via return or throw.
  throw new Error("callGemini: exhausted retries without result");
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
    logger.error({ rawTextLength: rawText.length }, "[habit-planner] JSON.parse failed");
    throw e;
  }
  return habitPlanSchema.parse(parsed);
}
