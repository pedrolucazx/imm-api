import { generateHabitPlan } from "@/modules/habits/habit-planner.js";

jest.mock("@/core/config/env.js", () => ({
  env: {
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_API_URL: "https://gemini.test",
    JWT_REFRESH_EXPIRES: "7d",
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeGeminiResponse(text: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

const FULL_PLAN = JSON.stringify({
  schema_version: 2,
  plan_type: "full",
  strategy: "Progressive skill mastery",
  phases: [
    {
      phase: 1,
      days: "1-22",
      theme: "Foundation",
      daily_tasks: ["Listen 15min", "Repeat phrases"],
    },
    {
      phase: 2,
      days: "23-44",
      theme: "Consolidation",
      daily_tasks: ["Shadow 20min", "Write sentences"],
    },
    { phase: 3, days: "45-66", theme: "Fluency", daily_tasks: ["Converse 30min", "Review vocab"] },
  ],
  total_time_per_day_minutes: 30,
  success_metrics: "Reach B1 level in 66 days",
});

const LIGHT_PLAN = JSON.stringify({
  schema_version: 2,
  plan_type: "light",
  strategy: "Consistency Anchoring",
  phases: [
    {
      phase: 1,
      days: "1-22",
      theme: "Habit Formation",
      weekly_focus: "Daily 15-min sessions",
      tip: "Attach to existing routine",
    },
    {
      phase: 2,
      days: "23-44",
      theme: "Momentum",
      weekly_focus: "Increase intensity gradually",
      tip: "Track streaks visually",
    },
    {
      phase: 3,
      days: "45-66",
      theme: "Automaticity",
      weekly_focus: "Make it non-negotiable",
      tip: "Reward yourself weekly",
    },
  ],
  total_time_per_day_minutes: 15,
  success_metrics: "66 consecutive days completed",
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe("generateHabitPlan — skill-building (full)", () => {
  it("returns parsed full plan on Gemini success", async () => {
    mockFetch.mockResolvedValue(makeGeminiResponse(FULL_PLAN));

    const plan = await generateHabitPlan(
      {
        name: "Inglês",
        targetSkill: "en-US",
        painPoints: ["pronuncia"],
        availableMinutes: 30,
        level: "beginner",
      },
      "skill-building"
    );

    expect(plan.plan_type).toBe("full");
    expect(plan.schema_version).toBe(2);
    expect(plan.phases).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://gemini.test");
    expect(url).not.toContain("test-gemini-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-gemini-key");
    const body = JSON.parse(init.body as string) as {
      generationConfig: { maxOutputTokens: number };
    };
    expect(body.generationConfig.maxOutputTokens).toBe(8192);
  });
});

describe("generateHabitPlan — tracking-coached (light)", () => {
  it("returns parsed light plan on Gemini success", async () => {
    mockFetch.mockResolvedValue(makeGeminiResponse(LIGHT_PLAN));

    const plan = await generateHabitPlan(
      { name: "Meditação", painPoints: ["foco"], availableMinutes: 15, level: "beginner" },
      "tracking-coached"
    );

    expect(plan.plan_type).toBe("light");
    expect(plan.schema_version).toBe(2);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      generationConfig: { maxOutputTokens: number };
    };
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
  });
});

describe("generateHabitPlan — failures", () => {
  it("throws when Gemini API returns non-ok status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable" });

    await expect(
      generateHabitPlan(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building"
      )
    ).rejects.toThrow("Gemini API error: 503");
  });

  it("throws ZodError when Gemini returns invalid JSON structure", async () => {
    const invalidPlan = JSON.stringify({ schema_version: 2, plan_type: "full" }); // missing required fields
    mockFetch.mockResolvedValue(makeGeminiResponse(invalidPlan));

    await expect(
      generateHabitPlan(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building"
      )
    ).rejects.toThrow();
  });

  it("throws when Gemini returns empty candidates", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ candidates: [] }),
    });

    await expect(
      generateHabitPlan(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building"
      )
    ).rejects.toThrow("Gemini returned empty response");
  });

  it("throws when GEMINI_API_KEY is not configured", async () => {
    jest.resetModules();
    jest.doMock("@/core/config/env.js", () => ({
      env: {
        GEMINI_API_KEY: undefined,
        GEMINI_API_URL: "https://gemini.test",
        JWT_REFRESH_EXPIRES: "7d",
      },
    }));

    const { generateHabitPlan: generateWithoutKey } =
      await import("@/modules/habits/habit-planner.js");

    await expect(
      generateWithoutKey(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building"
      )
    ).rejects.toThrow("GEMINI_API_KEY is not configured");
  });
});
