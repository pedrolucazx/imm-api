export interface TranscriptionProvider {
  transcribe(
    audioBase64: string,
    mimeType: string,
    prompt: string,
    maxOutputTokens: number
  ): Promise<string>;
}
