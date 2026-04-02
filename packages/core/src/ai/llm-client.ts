/**
 * LLM provider interface — all AI calls go through this contract.
 * Implementations live in gemini-client.ts (and can be swapped for tests).
 */

export interface GenerateParams {
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
}

export interface LLMClient {
  /** Embed one or more texts into 768-dim vectors (text-embedding-004). */
  embed(texts: string[]): Promise<number[][]>;

  /** Basic content-safety check via Gemini. */
  moderate(input: string): Promise<ModerationResult>;

  /** Generate a completion (gemini-2.0-flash). */
  generate(prompt: string, params?: GenerateParams): Promise<GenerateResult>;

  /** Rough token estimate (chars / 4). */
  estimateTokens(text: string): number;
}
