const SKILL_BUILDING_LOCALES = ["en-US", "es-ES", "fr-FR", "pt-BR"] as const;
const SKILL_BUILDING_LOCALE_SET: Set<string> = new Set(SKILL_BUILDING_LOCALES);

export type TargetSkill =
  | (typeof SKILL_BUILDING_LOCALES)[number]
  | "general"
  | "fitness"
  | "mindfulness";
export type HabitMode = "skill-building" | "tracking-coached";

export function deriveHabitMode(targetSkill: TargetSkill): HabitMode {
  return SKILL_BUILDING_LOCALE_SET.has(targetSkill) ? "skill-building" : "tracking-coached";
}
