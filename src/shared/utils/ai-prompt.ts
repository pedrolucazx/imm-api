const VALID_LANGUAGES = new Set(["pt-BR", "en-US", "es-ES", "fr-FR"]);
const BCP47_REGEX = /^[a-z]{2}-[A-Z]{2}$/;

export function langInstruction(uiLanguage: string): string {
  let safeLanguage = "pt-BR";
  if (
    typeof uiLanguage === "string" &&
    BCP47_REGEX.test(uiLanguage) &&
    VALID_LANGUAGES.has(uiLanguage)
  ) {
    safeLanguage = uiLanguage;
  }
  return `IMPORTANT: Write ALL text fields in the language with code "${safeLanguage}" (e.g. pt-BR = Brazilian Portuguese, en-US = English, es-ES = Spanish).`;
}
