// Gemini adapter — the only LLMClient implementation today.
//
// Wraps the `generativelanguage.googleapis.com` REST endpoint we were using
// directly before the adapter existed. Contract matches `LLMClient` from
// `./types.ts`; see that file for the surface shape.
//
// Env:
//   GEMINI_API_KEY — required. Missing key throws LLMError({ reason: 'config' })
//                    so the factory fails loud at startup rather than hitting
//                    a silent "(AI unavailable — no API key configured)" path.
//
// Non-obvious behavior:
//  - We default temperature to 0.7 and maxOutputTokens to 1024 to match the
//    old call shape inside ai-generate/index.ts. Change per-call, not here.
//  - generateJson uses Gemini's `responseMimeType: 'application/json'` hint,
//    which makes the model far less chatty about markdown fences but does NOT
//    guarantee strict JSON — we still wrap JSON.parse in a try/catch and
//    promote failures to LLMError({ reason: 'invalid_output' }).

import type {
  GenerateJsonOptions,
  GenerateTextOptions,
  LLMClient,
} from './types.ts';
import { LLMError } from './types.ts';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

interface GeminiGenerationConfig {
  temperature: number;
  maxOutputTokens: number;
  responseMimeType?: string;
}

interface GeminiRequestBody {
  contents: Array<{ parts: Array<{ text: string }> }>;
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig: GeminiGenerationConfig;
}

export class GeminiClient implements LLMClient {
  private readonly apiKey: string;

  constructor(apiKey: string | undefined = Deno.env.get('GEMINI_API_KEY')) {
    if (!apiKey) {
      throw new LLMError({
        reason: 'config',
        message: 'GEMINI_API_KEY is not set',
      });
    }
    this.apiKey = apiKey;
  }

  async generateText(opts: GenerateTextOptions): Promise<string> {
    const body = this.buildBody(opts);
    return await this.callAndExtractText(body);
  }

  async generateJson<T>(opts: GenerateJsonOptions<T>): Promise<T> {
    const body = this.buildBody({
      system: opts.system,
      prompt: opts.prompt,
      maxOutputTokens: opts.maxOutputTokens,
      // JSON responses want low temperature for structure; 0.2 is a reasonable
      // default, still tunable per-call if we ever need creative JSON.
      temperature: 0.2,
    });
    body.generationConfig.responseMimeType = 'application/json';

    const raw = await this.callAndExtractText(body);

    // Gemini with JSON mode usually returns bare JSON, but older models/paths
    // still wrap in ```json fences occasionally. Strip them defensively.
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new LLMError({
        reason: 'invalid_output',
        message: 'Gemini returned non-JSON output',
        cause: err,
      });
    }

    const result = opts.schema.safeParse(parsed);
    if (!result.success) {
      throw new LLMError({
        reason: 'invalid_output',
        message: `Gemini JSON did not match schema: ${result.error.message}`,
        cause: result.error,
      });
    }
    return result.data;
  }

  private buildBody(opts: GenerateTextOptions): GeminiRequestBody {
    const body: GeminiRequestBody = {
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      },
    };
    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }
    return body;
  }

  private async callAndExtractText(body: GeminiRequestBody): Promise<string> {
    let res: Response;
    try {
      res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LLMError({
        reason: 'upstream',
        message: 'Network error calling Gemini',
        cause: err,
      });
    }

    if (res.status === 429) {
      const detail = await safeText(res);
      throw new LLMError({
        reason: 'rate_limited',
        message: `Gemini rate limit: ${detail}`,
      });
    }

    if (!res.ok) {
      const detail = await safeText(res);
      throw new LLMError({
        reason: 'upstream',
        message: `Gemini API error: ${res.status} ${detail}`,
      });
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch (err) {
      throw new LLMError({
        reason: 'upstream',
        message: 'Gemini returned non-JSON response envelope',
        cause: err,
      });
    }

    // Gemini envelope: { candidates: [{ content: { parts: [{ text }] } }] }
    const text =
      (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        ?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return text;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '(no body)';
  }
}
