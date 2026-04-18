// Per-user rate limiting for Supabase Edge Functions.
//
// Backed by the `consume_rate_limit` Postgres function (migration
// 20260416180000_rate_limits.sql). This helper wraps the RPC, produces a
// ready-to-return HTTP 429 response when the caller is over the cap, and
// attaches the standard `X-RateLimit-*` + `Retry-After` headers so clients
// can self-pace.
//
// Why a helper file (not inline in each handler)?
// - One code path for the 429 response shape (clients key on this).
// - One place to add Sentry breadcrumbs / Prometheus counters later.
// - One seam for unit-testing without calling into Postgres.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type { Logger } from './logger.ts';

export interface RateLimitOptions {
  bucket: string;
  max: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Check (and if allowed, consume) a rate-limit slot for a user.
 *
 * Service-role client is required — the RPC is only callable by service_role
 * and the table RLS denies direct client access.
 */
export async function consumeRateLimit(
  supabase: SupabaseClient,
  userId: string,
  opts: RateLimitOptions,
  logger?: Logger,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: opts.bucket,
    p_max: opts.max,
    p_window_seconds: opts.windowSeconds,
  });

  if (error) {
    // Fail open on infra failure — but loudly. A failing rate-limit DB should
    // not brick user-facing features. If this fires repeatedly, Sentry will
    // alert via the edge-fn top-level catch.
    logger?.error('rate_limit_rpc_failed', {
      bucket: opts.bucket,
      err: error.message,
    });
    return {
      allowed: true,
      used: 0,
      remaining: opts.max,
      resetAt: new Date(Date.now() + opts.windowSeconds * 1000),
    };
  }

  // `returns table` RPCs come back as arrays of rows; we expect exactly one.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    logger?.error('rate_limit_rpc_empty', { bucket: opts.bucket });
    return {
      allowed: true,
      used: 0,
      remaining: opts.max,
      resetAt: new Date(Date.now() + opts.windowSeconds * 1000),
    };
  }

  return {
    allowed: Boolean(row.allowed),
    used: Number(row.used ?? 0),
    remaining: Number(row.remaining ?? 0),
    resetAt: new Date(row.reset_at),
  };
}

/**
 * Build the standard `X-RateLimit-*` headers for every response (allowed or
 * not) so clients can render a usage meter without a second round-trip.
 */
export function rateLimitHeaders(result: RateLimitResult, max: number): Record<string, string> {
  const resetEpoch = Math.floor(result.resetAt.getTime() / 1000);
  return {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(resetEpoch),
  };
}

/**
 * Return a fully-formed 429 Response for a rejected request. Includes the
 * `Retry-After` header (seconds until the window resets) and the same
 * `X-RateLimit-*` triple as successful responses.
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
  max: number,
  corsHeaders: Record<string, string>,
): Response {
  const retryAfterSec = Math.max(
    1,
    Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
  );
  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      message: 'Too many requests. Try again after the reset window.',
      used: result.used,
      limit: max,
      reset_at: result.resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
        ...rateLimitHeaders(result, max),
      },
    },
  );
}
