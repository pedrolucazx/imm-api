import { env } from "../config/env.js";
import { GeminiTextProvider } from "./providers/gemini-text.js";
import { withTextAIFallback } from "./with-fallback.js";
import type { TextAIProvider } from "./text-ai.interface.js";

export function createTextAIProvider(providerList: string): TextAIProvider {
  const names = providerList
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (names.length === 0) throw new Error("AI_PROVIDER must not be empty");

  const providers = names.map((name) => {
    switch (name) {
      case "gemini":
        return new GeminiTextProvider();
      default:
        throw new Error(`Unknown AI provider: "${name}". Supported: gemini`);
    }
  });

  return providers.length === 1 ? providers[0] : withTextAIFallback(providers);
}

let _textAIInstance: TextAIProvider | null = null;

export function getTextAIProvider(): TextAIProvider {
  if (!_textAIInstance) {
    _textAIInstance = createTextAIProvider(env.AI_PROVIDER);
  }
  return _textAIInstance;
}
