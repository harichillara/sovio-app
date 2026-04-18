// LLM provider adapter interface.
//
// The edge function was originally wired directly to Gemini via `fetch`. This
// abstraction lets us swap providers (or run A/B experiments) without rewriting
// every prompt site. Each op in `ai-generate/index.ts` now calls
// `llm.generateText(...)` or `llm.generateJson(...)` instead of the raw REST
// request.
//
// Design notes:
//  - `generateJson` enforces structured output. Providers that have a
//    native JSON-mode (Gemini's `responseMimeType: 'application/json'`,
//    OpenAI's JSON mode, Anthropic's tool-use, etc.) should use it; the
//    adapter parses the response through the caller-supplied zod schema and
//    throws `LLMError({ reason: 'invalid_output' })` on mismatch.
//  - `LLMError` carries a discriminant `reason` so callers can decide whether
//    to retry, fall back to a safe default, or surface an error.
//  - Providers read their own secrets from env; the factory is the only place
//    that knows which provider is active.

import type { ZodType } from '../validate.ts';

export interface GenerateTextOptions {
  system?: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GenerateJsonOptions<T> {
  system?: string;
  prompt: string;
  schema: ZodType<T>;
  maxOutputTokens?: number;
}

export interface LLMClient {
  generateText(opts: GenerateTextOptions): Promise<string>;
  generateJson<T>(opts: GenerateJsonOptions<T>): Promise<T>;
}

export type LLMErrorReason =
  | 'rate_limited'   // provider returned 429 / quota exhaustion
  | 'invalid_output' // JSON parse failed or schema validation failed
  | 'upstream'       // network error or non-2xx from provider
  | 'config';        // missing API key / unknown provider

export class LLMError extends Error {
  reason: LLMErrorReason;

  constructor(opts: { reason: LLMErrorReason; message?: string; cause?: unknown }) {
    super(opts.message ?? opts.reason);
    this.name = 'LLMError';
    this.reason = opts.reason;
    if (opts.cause !== undefined) {
      // `cause` is a standard Error field on Deno/ESM runtimes.
      (this as unknown as { cause: unknown }).cause = opts.cause;
    }
  }
}
