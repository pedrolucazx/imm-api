export interface AIGenerateOptions {
  /**
   * Provider-specific hint for structured JSON output.
   * Gemini maps this to generationConfig.responseSchema.
   * Other providers may use equivalent mechanisms or ignore it.
   */
  responseSchema?: object;
  /**
   * Sampling temperature. Defaults vary by provider.
   */
  temperature?: number;
}

export interface TextAIProvider {
  generate(prompt: string, maxOutputTokens: number, options?: AIGenerateOptions): Promise<string>;
}
