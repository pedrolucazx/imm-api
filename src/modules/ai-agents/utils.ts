/**
 * Generates a language instruction string for AI prompts based on a UI language code.
 * Sanitizes the input to strip control characters and quotes, and falls back to "pt-BR".
 * @param uiLanguage - The UI language code (e.g., "pt-BR", "en-US")
 * @returns Instruction string for the AI
 */
export function langInstruction(uiLanguage: string): string {
  const safeLanguage = uiLanguage.replace(/[\r\n"]/g, "").trim() || "pt-BR";
  return `IMPORTANT: Write ALL text fields in the language with code "${safeLanguage}" (e.g. pt-BR = Brazilian Portuguese, en-US = English, es-ES = Spanish).`;
}
