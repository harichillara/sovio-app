// LLM client factory.
//
// One place to pick a provider; read `LLM_PROVIDER` from env (default 'gemini').
// Call sites inside ai-generate/index.ts use `getLLMClient()` — they don't
// know or care which provider is active.
//
// To add a new provider:
//   1. Create `./<provider>.ts` implementing `LLMClient` from `./types.ts`.
//   2. Add a case below.
//   3. Point `LLM_PROVIDER` at it in the function's env config.
//
// Keep this file boring — factory logic only. Any shared helpers belong in
// `./types.ts` or a separate util module.

import type { LLMClient } from './types.ts';
import { LLMError } from './types.ts';
import { GeminiClient } from './gemini.ts';

export type { LLMClient, GenerateTextOptions, GenerateJsonOptions, LLMErrorReason } from './types.ts';
export { LLMError } from './types.ts';
export { GeminiClient } from './gemini.ts';

export function getLLMClient(): LLMClient {
  const provider = (Deno.env.get('LLM_PROVIDER') ?? 'gemini').toLowerCase();

  switch (provider) {
    case 'gemini':
      return new GeminiClient();

    // TODO(provider-swap): wire additional providers here. Each must
    // implement the LLMClient interface from ./types.ts. Example sketches:
    //
    //   case 'openai':
    //     return new OpenAIClient(); // reads OPENAI_API_KEY
    //
    //   case 'anthropic':
    //     return new AnthropicClient(); // reads ANTHROPIC_API_KEY
    //
    // Providers MUST map their native error/rate-limit shapes onto LLMError's
    // `reason` discriminant so call sites don't need provider-specific code.

    default:
      throw new LLMError({
        reason: 'config',
        message: `Unknown LLM_PROVIDER: ${provider}`,
      });
  }
}
