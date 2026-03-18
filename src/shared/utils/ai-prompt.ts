export function langInstruction(uiLanguage: string): string {
  const safeLanguage = uiLanguage.replace(/[\r\n"]/g, "").trim() || "pt-BR";
  return `IMPORTANT: Write ALL text fields in the language with code "${safeLanguage}" (e.g. pt-BR = Brazilian Portuguese, en-US = English, es-ES = Spanish).`;
}
