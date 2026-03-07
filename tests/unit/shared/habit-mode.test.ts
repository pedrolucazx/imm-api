import { deriveHabitMode } from "@/shared/schemas/habit-mode.js";
import type { TargetSkill } from "@/shared/schemas/habit-mode.js";

describe("deriveHabitMode", () => {
  it.each(["en-US", "es-ES", "fr-FR", "pt-BR"] as TargetSkill[])(
    "returns skill-building for locale %s",
    (locale) => {
      expect(deriveHabitMode(locale)).toBe("skill-building");
    }
  );

  it.each(["general", "fitness", "mindfulness"] as TargetSkill[])(
    "returns tracking-coached for %s",
    (skill) => {
      expect(deriveHabitMode(skill)).toBe("tracking-coached");
    }
  );
});
