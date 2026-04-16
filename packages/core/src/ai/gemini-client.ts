import type {
  LLMClient,
  GenerateParams,
  GenerateResult,
  ModerationResult,
} from './llm-client';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const EMBEDDING_MODEL = 'models/text-embedding-004';
const GENERATION_MODEL = 'models/gemini-2.0-flash';

/**
 * Gemini implementation of LLMClient.
 * Uses the REST API so it works in both React Native and Edge Functions.
 */
export class GeminiClient implements LLMClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('GeminiClient requires an API key');
    this.apiKey = apiKey;
  }

  // ---------------------------------------------------------------------------
  // embed
  // ---------------------------------------------------------------------------

  async embed(texts: string[]): Promise<number[][]> {
    const url = `${BASE_URL}/${EMBEDDING_MODEL}:batchEmbedContents`;

    const requests = texts.map((text) => ({
      model: EMBEDDING_MODEL,
      content: { parts: [{ text }] },
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini embed error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as {
      embeddings: { values: number[] }[];
    };

    return json.embeddings.map((e) => e.values);
  }

  // ---------------------------------------------------------------------------
  // generate
  // ---------------------------------------------------------------------------

  async generate(
    prompt: string,
    params?: GenerateParams,
  ): Promise<GenerateResult> {
    const url = `${BASE_URL}/${GENERATION_MODEL}:generateContent`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: params?.temperature ?? 0.7,
        maxOutputTokens: params?.maxTokens ?? 1024,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini generate error ${res.status}: ${errBody}`);
    }

    const json = (await res.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
      }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const text =
      json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

    return { text, usage: { inputTokens, outputTokens } };
  }

  // ---------------------------------------------------------------------------
  // moderate
  // ---------------------------------------------------------------------------

  async moderate(input: string): Promise<ModerationResult> {
    const prompt = [
      'You are a content-safety classifier. Evaluate the following text and respond in JSON.',
      'Schema: { "flagged": boolean, "categories": { "harassment": bool, "hate": bool, "sexual": bool, "violence": bool, "self_harm": bool, "spam": bool } }',
      'Respond ONLY with valid JSON, no explanation.',
      '',
      `Text: """${input}"""`,
    ].join('\n');

    try {
      const result = await this.generate(prompt, {
        temperature: 0,
        maxTokens: 256,
      });

      const cleaned = result.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as ModerationResult;
      return {
        flagged: parsed.flagged ?? false,
        categories: parsed.categories ?? {},
      };
    } catch (err) {
      // Fail closed: if moderation is unavailable, treat content as flagged
      // to prevent unsafe content from reaching other users.
      console.error(
        '[GeminiClient.moderate] Content moderation failed — defaulting to FLAGGED.',
        err instanceof Error ? err.message : err,
      );
      return {
        flagged: true,
        categories: { moderation_unavailable: true },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // estimateTokens
  // ---------------------------------------------------------------------------

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
