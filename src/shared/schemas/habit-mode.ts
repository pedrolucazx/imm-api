const SKILL_BUILDING_VALUES = ["en-US", "es-ES", "fr-FR", "pt-BR"] as const;
const SKILL_BUILDING = new Set(SKILL_BUILDING_VALUES);

export type TargetSkill =
  | (typeof SKILL_BUILDING_VALUES)[number]
  | "general"
  | "fitness"
  | "mindfulness";
export type HabitMode = "skill-building" | "tracking-coached";

export function deriveHabitMode(targetSkill: TargetSkill): HabitMode {
  return SKILL_BUILDING.has(targetSkill as (typeof SKILL_BUILDING_VALUES)[number])
    ? "skill-building"
    : "tracking-coached";
}
