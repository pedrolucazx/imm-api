const SKILL_BUILDING = new Set(["en-US", "es-ES", "fr-FR", "pt-BR"]);

export type HabitMode = "skill-building" | "tracking-coached";
export type TargetSkill =
  | "en-US"
  | "es-ES"
  | "fr-FR"
  | "pt-BR"
  | "general"
  | "fitness"
  | "mindfulness";

export function deriveHabitMode(targetSkill: string): HabitMode {
  return SKILL_BUILDING.has(targetSkill) ? "skill-building" : "tracking-coached";
}
