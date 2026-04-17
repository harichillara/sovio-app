// Zod-based request body validation for Supabase edge functions.
//
// Every user-authored JSON body should be parsed through a Zod schema before
// reaching business logic. On mismatch this helper produces a ready-to-return
// HTTP 400 with a structured error message, so handlers stay linear:
//
//     const parsed = await parseJson(req, MySchema, corsHeaders);
//     if (!parsed.ok) return parsed.response;
//     const body = parsed.data;
//
// Why "result" shape and not throwing? Throwing would couple validation to each
// function's own HttpError class (the shape differs per file). The "result"
// return is framework-neutral — the caller controls CORS headers and logging.
//
// Zod is pinned to v3.23.8 (stable v3, not v4 mini-mode) to avoid surprise
// breakage on remote URL imports.

import { z, ZodError, ZodType, ZodTypeDef } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
export { z, ZodError };
export type { ZodType, ZodTypeDef };

export interface ValidationFailure {
  ok: false;
  response: Response;
  issues: Array<{ path: string; message: string }>;
}

export interface ValidationSuccess<T> {
  ok: true;
  data: T;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Parse a Request's JSON body against a Zod schema.
 *
 * Returns `{ ok: true, data }` on success, or `{ ok: false, response, issues }`
 * on failure — `response` is a 400 JSON response ready to return, and `issues`
 * is the same list the client sees (useful for structured logging before the
 * response is returned).
 */
export async function parseJson<T>(
  req: Request,
  schema: ZodType<T, ZodTypeDef, unknown>,
  corsHeaders: Record<string, string>,
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    const issues = [{ path: '(root)', message: 'Request body was not valid JSON' }];
    return {
      ok: false,
      issues,
      response: new Response(
        JSON.stringify({ error: 'invalid_json', message: 'Request body was not valid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.') || '(root)',
      message: i.message,
    }));
    return {
      ok: false,
      issues,
      response: new Response(
        JSON.stringify({ error: 'validation_failed', issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  return { ok: true, data: result.data };
}
