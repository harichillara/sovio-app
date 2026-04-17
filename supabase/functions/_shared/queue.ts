// Queue helper for the `ai_jobs` table.
//
// Wraps the Postgres functions installed by migration
// `20260416200000_ai_jobs_queue.sql` (enqueue_ai_job, claim_ai_jobs,
// complete_ai_job, fail_ai_job) so edge-function code can speak in terms of
// typed jobs instead of raw RPC payloads.
//
// Why the split (DB functions + TS helper)?
//   - DB functions own the atomicity (FOR UPDATE SKIP LOCKED, claim tokens).
//   - TS helper owns the retry policy (exponential backoff calc) and the
//     per-job dispatch so handlers get a clean `(payload) => result` API.
//
// Tests live next to this file in queue.test.ts.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type { Logger } from './logger.ts';

export interface EnqueueOptions {
  userId: string;
  jobType: string;
  payload?: Record<string, unknown>;
  /**
   * Dedup key. While a job with the same key is still `queued` or `claimed`,
   * re-enqueue is a no-op. Scope keys to the fan-out cycle, e.g.
   * `suggestions:<userId>:<yyyymmddhh>` so next hour's batch enqueues fresh.
   */
  jobKey?: string;
  maxAttempts?: number;
  priority?: number;
  scheduledFor?: Date;
}

export interface EnqueueResult {
  id: string | null;
  enqueued: boolean;
}

export interface ClaimedJob {
  id: string;
  userId: string;
  jobType: string;
  payload: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
  claimToken: string;
}

/**
 * Enqueue a single job. Safe to call with the same `jobKey` multiple times —
 * subsequent calls while the original is still active return
 * `{ enqueued: false }`.
 */
export async function enqueueAiJob(
  supabase: SupabaseClient,
  opts: EnqueueOptions,
  logger?: Logger,
): Promise<EnqueueResult> {
  const { data, error } = await supabase.rpc('enqueue_ai_job', {
    p_user_id: opts.userId,
    p_job_type: opts.jobType,
    p_payload: opts.payload ?? {},
    p_job_key: opts.jobKey ?? null,
    p_max_attempts: opts.maxAttempts ?? 3,
    p_scheduled_for: (opts.scheduledFor ?? new Date()).toISOString(),
    p_priority: opts.priority ?? 100,
  });

  if (error) {
    // Don't throw — the caller is typically iterating over thousands of
    // users, and losing one enqueue shouldn't blow up the whole fan-out.
    logger?.error('enqueue_ai_job_failed', { jobType: opts.jobType, err: error.message });
    return { id: null, enqueued: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    id: (row?.id as string | null) ?? null,
    enqueued: Boolean(row?.enqueued),
  };
}

/**
 * Claim up to `batchSize` ready jobs. The server sets a visibility timeout
 * so stuck workers don't permanently own jobs — after `visibilityTimeoutSec`
 * an un-acked claim becomes re-claimable by the next tick.
 *
 * Keep `visibilityTimeoutSec` comfortably above the p99 handler duration
 * (Gemini latency + DB writes) — 120s is a safe default for the current ops.
 */
export async function claimAiJobs(
  supabase: SupabaseClient,
  batchSize = 8,
  visibilityTimeoutSec = 120,
  logger?: Logger,
): Promise<ClaimedJob[]> {
  const { data, error } = await supabase.rpc('claim_ai_jobs', {
    p_batch_size: batchSize,
    p_visibility_timeout_seconds: visibilityTimeoutSec,
  });

  if (error) {
    logger?.error('claim_ai_jobs_failed', { err: error.message });
    return [];
  }

  // `returns table` comes back as an array; empty is a valid "queue drained".
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    jobType: String(r.job_type),
    payload: (r.payload as Record<string, unknown>) ?? {},
    attempt: Number(r.attempt ?? 0),
    maxAttempts: Number(r.max_attempts ?? 3),
    claimToken: String(r.claim_token),
  }));
}

/**
 * Ack a successful run. Token is checked server-side so a stuck worker that
 * wakes up after its claim expired can't clobber a fresh claim's result.
 * Returns false if the ack was stale.
 */
export async function completeAiJob(
  supabase: SupabaseClient,
  jobId: string,
  claimToken: string,
  result?: Record<string, unknown>,
  logger?: Logger,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('complete_ai_job', {
    p_id: jobId,
    p_claim_token: claimToken,
    p_result: result ?? null,
  });

  if (error) {
    logger?.error('complete_ai_job_failed', { jobId, err: error.message });
    return false;
  }
  // RPC returns an integer row count (0 or 1).
  return Number(data ?? 0) === 1;
}

/**
 * Nack with retry. Re-queues with backoff until `max_attempts` — then the
 * server moves it to DLQ automatically. Return value distinguishes the
 * outcome so callers can log transitions into the DLQ specifically.
 */
export async function failAiJob(
  supabase: SupabaseClient,
  jobId: string,
  claimToken: string,
  errorMessage: string,
  retryInSeconds: number,
  logger?: Logger,
): Promise<'stale' | 'retry' | 'dlq'> {
  const { data, error } = await supabase.rpc('fail_ai_job', {
    p_id: jobId,
    p_claim_token: claimToken,
    p_error: errorMessage.slice(0, 2000), // cap what we persist
    p_retry_in_seconds: Math.max(1, Math.floor(retryInSeconds)),
  });

  if (error) {
    logger?.error('fail_ai_job_failed', { jobId, err: error.message });
    return 'stale';
  }

  const code = Number(data ?? 0);
  if (code === 1) return 'retry';
  if (code === 2) return 'dlq';
  return 'stale';
}

/**
 * Backoff with full jitter (AWS Architecture Blog "Exponential Backoff And
 * Jitter"). Prevents thundering herds when a whole batch fails at once
 * against a transiently-down dependency.
 */
export function nextBackoffSeconds(attempt: number): number {
  const base = 30;
  const max = 15 * 60; // 15 min cap — past this, the hourly cron re-enqueues anyway
  const exp = Math.min(base * 2 ** Math.max(0, attempt - 1), max);
  return Math.max(1, Math.floor(Math.random() * exp));
}

/**
 * Run claimed jobs with bounded concurrency. `handler` is invoked per job;
 * if it resolves, we complete; if it throws, we fail (which re-queues with
 * backoff or DLQs).
 *
 * Returns per-outcome counts for observability (logged by the caller).
 */
export async function runJobs(
  supabase: SupabaseClient,
  jobs: ClaimedJob[],
  handler: (job: ClaimedJob) => Promise<Record<string, unknown> | void>,
  concurrency = 4,
  logger?: Logger,
): Promise<{ succeeded: number; retried: number; dlq: number; stale: number }> {
  const counts = { succeeded: 0, retried: 0, dlq: 0, stale: 0 };
  // Worker pool pattern — N workers share a single queue index. Simple &
  // avoids `Promise.all(map)` which would run all jobs in parallel regardless
  // of the concurrency cap.
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const idx = cursor++;
      const job = jobs[idx];
      try {
        const result = await handler(job);
        const ok = await completeAiJob(
          supabase,
          job.id,
          job.claimToken,
          (result ?? undefined) as Record<string, unknown> | undefined,
          logger,
        );
        if (ok) counts.succeeded++;
        else counts.stale++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const backoff = nextBackoffSeconds(job.attempt);
        const outcome = await failAiJob(supabase, job.id, job.claimToken, msg, backoff, logger);
        if (outcome === 'retry') counts.retried++;
        else if (outcome === 'dlq') counts.dlq++;
        else counts.stale++;
        logger?.warn('ai_job_handler_failed', {
          jobId: job.id,
          jobType: job.jobType,
          attempt: job.attempt,
          outcome,
          err: msg,
        });
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return counts;
}
