import { env } from "../config/env.js";
import { GeminiTranscriptionProvider } from "./providers/gemini-transcription.js";
import { withTranscriptionFallback } from "./with-fallback.js";
import type { TranscriptionProvider } from "./transcription.interface.js";

export function createTranscriptionProvider(providerList: string): TranscriptionProvider {
  const names = providerList
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (names.length === 0) throw new Error("TRANSCRIPTION_PROVIDER must not be empty");

  const providers = names.map((name) => {
    switch (name) {
      case "gemini":
        return new GeminiTranscriptionProvider();
      default:
        throw new Error(`Unknown transcription provider: "${name}". Supported: gemini`);
    }
  });

  return providers.length === 1 ? providers[0] : withTranscriptionFallback(providers);
}

let _transcriptionInstance: TranscriptionProvider | null = null;

export function getTranscriptionProvider(): TranscriptionProvider {
  if (!_transcriptionInstance) {
    _transcriptionInstance = createTranscriptionProvider(env.TRANSCRIPTION_PROVIDER);
  }
  return _transcriptionInstance;
}
