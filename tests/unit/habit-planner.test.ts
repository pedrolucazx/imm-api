import { generateHabitPlan } from "@/modules/habits/habit-planner.js";
import type { TextAIProvider } from "@/core/ai/text-ai.interface.js";

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
      journal_prompt: "What did you practice today?",
    },
    {
      phase: 2,
      days: "23-44",
      theme: "Consolidation",
      daily_tasks: ["Shadow 20min", "Write sentences"],
      journal_prompt: "What errors did you make and what did you learn?",
    },
    {
      phase: 3,
      days: "45-66",
      theme: "Fluency",
      daily_tasks: ["Converse 30min", "Review vocab"],
      journal_prompt: "In what real situation did you use English today?",
    },
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
      journal_prompt: "How was your session today?",
    },
    {
      phase: 2,
      days: "23-44",
      theme: "Momentum",
      weekly_focus: "Increase intensity gradually",
      tip: "Track streaks visually",
      journal_prompt: "What idea from today impacted you?",
    },
    {
      phase: 3,
      days: "45-66",
      theme: "Automaticity",
      weekly_focus: "Make it non-negotiable",
      tip: "Reward yourself weekly",
      journal_prompt: "How is this habit changing the way you think?",
    },
  ],
  total_time_per_day_minutes: 15,
  success_metrics: "66 consecutive days completed",
});

function makeMockTextAI(response: string): TextAIProvider {
  return { generate: jest.fn().mockResolvedValue(response) };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateHabitPlan — skill-building (full)", () => {
  it("returns parsed full plan when textAI.generate succeeds", async () => {
    const textAI = makeMockTextAI(FULL_PLAN);

    const plan = await generateHabitPlan(
      {
        name: "Inglês",
        targetSkill: "en-US",
        painPoints: ["pronuncia"],
        availableMinutes: 30,
        level: "beginner",
      },
      "skill-building",
      textAI
    );

    expect(plan.plan_type).toBe("full");
    expect(plan.schema_version).toBe(2);
    expect(plan.phases).toHaveLength(3);
  });

  it("calls textAI.generate with maxOutputTokens=8192 for full plan", async () => {
    const textAI = makeMockTextAI(FULL_PLAN);

    await generateHabitPlan(
      { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
      "skill-building",
      textAI
    );

    expect(textAI.generate).toHaveBeenCalledWith(
      expect.any(String),
      8192,
      expect.objectContaining({ responseSchema: expect.any(Object), temperature: 0.4 })
    );
  });
});

describe("generateHabitPlan — tracking-coached (light)", () => {
  it("returns parsed light plan when textAI.generate succeeds", async () => {
    const textAI = makeMockTextAI(LIGHT_PLAN);

    const plan = await generateHabitPlan(
      { name: "Meditação", painPoints: ["foco"], availableMinutes: 15, level: "beginner" },
      "tracking-coached",
      textAI
    );

    expect(plan.plan_type).toBe("light");
    expect(plan.schema_version).toBe(2);
  });

  it("calls textAI.generate with maxOutputTokens=4096 for light plan", async () => {
    const textAI = makeMockTextAI(LIGHT_PLAN);

    await generateHabitPlan(
      { name: "Meditação", painPoints: ["foco"], availableMinutes: 15, level: "beginner" },
      "tracking-coached",
      textAI
    );

    expect(textAI.generate).toHaveBeenCalledWith(
      expect.any(String),
      4096,
      expect.objectContaining({ temperature: 0.4 })
    );
  });
});

describe("generateHabitPlan — failures", () => {
  it("throws ZodError when plan is missing required fields", async () => {
    const invalid = JSON.stringify({ schema_version: 2, plan_type: "full" }); // missing phases etc.
    const textAI = makeMockTextAI(invalid);

    await expect(
      generateHabitPlan(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building",
        textAI
      )
    ).rejects.toThrow();
  });

  it("throws when a phase is missing journal_prompt", async () => {
    const invalid = JSON.parse(FULL_PLAN) as { phases: Array<Record<string, unknown>> };
    delete invalid.phases[0].journal_prompt;
    const textAI = makeMockTextAI(JSON.stringify(invalid));

    await expect(
      generateHabitPlan(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building",
        textAI
      )
    ).rejects.toThrow();
  });

  it("propagates errors thrown by textAI.generate", async () => {
    const textAI: TextAIProvider = {
      generate: jest.fn().mockRejectedValue(new Error("AI provider error")),
    };

    await expect(
      generateHabitPlan(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building",
        textAI
      )
    ).rejects.toThrow("AI provider error");
  });

  it("throws when textAI returns invalid JSON", async () => {
    const textAI = makeMockTextAI("not json at all {{");

    await expect(
      generateHabitPlan(
        { name: "Inglês", painPoints: ["pronuncia"], availableMinutes: 30, level: "beginner" },
        "skill-building",
        textAI
      )
    ).rejects.toThrow();
  });
});
