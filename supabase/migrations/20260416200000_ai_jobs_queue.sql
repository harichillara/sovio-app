-- ==========================================================================
-- AI jobs queue (Phase 3, Task 15)
-- ==========================================================================
-- Promotes the existing `ai_jobs` table to a proper queue with claim/ack,
-- retry-with-backoff, and DLQ. Replaces the previous serial
-- `for (const userId of users) { ... }` fan-out in ai-generate's cron
-- handlers, which couldn't survive the edge-function timeout past ~1k DAU
-- and silently dropped per-user failures.
--
-- Design choices:
--   * Reuse `ai_jobs` rather than add a new table — less schema drift, and
--     the autopilot UI already keys off ai_jobs.user_id for user-visible
--     progress. New columns are added idempotently.
--   * Postgres-as-queue via `FOR UPDATE SKIP LOCKED`. No Redis, no SQS.
--     For our throughput (a few k jobs/hr) this is right-sized and keeps
--     the stack Supabase-only.
--   * Dedup via a UNIQUE partial index on `job_key` where status is active.
--     Lets callers enqueue idempotently (`suggestions:<userId>:<hour>`) so
--     re-firing the hourly cron doesn't pile up duplicate work.
--   * Visibility timeout (not transactional claim) so the worker can commit
--     per-job instead of holding a tx across Gemini calls. A claim that's
--     been held past `visibility_timeout_seconds` is treated as abandoned
--     and reclaimable — this is how SQS / pg-boss handle stuck workers.
-- ==========================================================================

-- Prereq: 20260416195000_ai_jobs_unify.sql renamed input→payload,
-- output→result, and added the `kind` discriminator ('autopilot' | 'queue')
-- with the merged status CHECK. This migration only adds queue-specific
-- columns and indexes and assumes those renames/constraints are in place.
--
-- All add-column statements use `if not exists` so re-application is safe.
-- The `payload` column is NOT added here — it already exists from the unify
-- migration (and wrapping it here would no-op under `if not exists` anyway).
alter table public.ai_jobs
  add column if not exists job_key                    text,
  add column if not exists priority                   integer     not null default 100,
  add column if not exists scheduled_for              timestamptz not null default now(),
  add column if not exists attempt                    integer     not null default 0,
  add column if not exists max_attempts               integer     not null default 3,
  add column if not exists claimed_at                 timestamptz,
  add column if not exists claim_token                uuid,
  add column if not exists visibility_timeout_seconds integer     not null default 120,
  add column if not exists last_error                 text,
  add column if not exists dlq_reason                 text;

-- Status CHECK is owned by the unify migration (kind-scoped), not this one.
-- Queue status values ('queued','claimed','succeeded','failed','dlq') are
-- already allowed for kind='queue' rows.

-- Dedup index — only enforced while a job with the same key is still active
-- AND the row is a queue job (kind='queue'). Prevents collisions with any
-- hypothetical 'autopilot' use of job_key.
create unique index if not exists ai_jobs_job_key_active_uniq
  on public.ai_jobs (job_key)
  where job_key is not null
    and status in ('queued', 'claimed')
    and kind   =  'queue';

-- Claim path — the hot query picks ready queue rows cheaply. Partial index
-- keeps autopilot rows out of the planner's way entirely.
create index if not exists ai_jobs_ready_idx
  on public.ai_jobs (priority, scheduled_for)
  where status in ('queued', 'claimed')
    and kind   =  'queue';

-- UI/debug path — "my recent jobs" for the autopilot screen.
create index if not exists ai_jobs_user_created_idx
  on public.ai_jobs (user_id, created_at desc);

-- ==========================================================================
-- enqueue_ai_job(...)
-- ==========================================================================
-- Inserts a new queued job, or silently no-ops if an active job with the
-- same job_key is already in flight. Returns the resulting row's id and
-- whether we actually enqueued (false = dedup hit).
-- ==========================================================================
create or replace function public.enqueue_ai_job(
  p_user_id        uuid,
  p_job_type       text,
  p_payload        jsonb       default '{}'::jsonb,
  p_job_key        text        default null,
  p_max_attempts   integer     default 3,
  p_scheduled_for  timestamptz default now(),
  p_priority       integer     default 100
)
returns table (id uuid, enqueued boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or p_job_type is null then
    raise exception 'enqueue_ai_job: p_user_id and p_job_type are required';
  end if;

  insert into public.ai_jobs(
    user_id, kind, job_type, status, payload, job_key,
    priority, scheduled_for, max_attempts, created_at, updated_at
  )
  values (
    p_user_id, 'queue', p_job_type, 'queued', coalesce(p_payload, '{}'::jsonb), p_job_key,
    p_priority, p_scheduled_for, p_max_attempts, now(), now()
  )
  -- Dedup against the partial unique index on (job_key) where status is active
  -- AND kind='queue'. If there's an in-flight twin, return nothing; caller
  -- interprets as "skipped".
  on conflict (job_key) where (job_key is not null and status in ('queued', 'claimed') and kind = 'queue')
  do nothing
  returning ai_jobs.id into v_id;

  if v_id is null then
    return query select null::uuid, false;
  else
    return query select v_id, true;
  end if;
end;
$$;

comment on function public.enqueue_ai_job(uuid, text, jsonb, text, integer, timestamptz, integer) is
  'Enqueue an ai_jobs entry. Dedups on (job_key) while the twin is still active (queued or claimed).';

-- ==========================================================================
-- claim_ai_jobs(p_batch_size, p_visibility_timeout_seconds)
-- ==========================================================================
-- Atomically claims up to `p_batch_size` ready jobs and returns them. A job
-- is "ready" when:
--   * status = 'queued' AND scheduled_for <= now(), OR
--   * status = 'claimed' but the worker holding it has disappeared
--     (claimed_at + visibility_timeout < now()) — this is the stuck-worker
--     reclaim path.
--
-- `FOR UPDATE SKIP LOCKED` lets concurrent workers claim disjoint batches
-- without blocking. Each claimed job gets a fresh UUID claim_token — the
-- worker must echo it on complete/fail, so an abandoned worker that wakes
-- up later can't overwrite a fresher claim's result.
-- ==========================================================================
create or replace function public.claim_ai_jobs(
  p_batch_size                integer default 8,
  p_visibility_timeout_seconds integer default 120
)
returns table (
  id           uuid,
  user_id      uuid,
  job_type     text,
  payload      jsonb,
  attempt      integer,
  max_attempts integer,
  claim_token  uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_batch_size <= 0 then
    raise exception 'claim_ai_jobs: p_batch_size must be positive';
  end if;

  return query
  with ready as (
    select j.id
      from public.ai_jobs j
      where j.kind = 'queue'
        and (
          (j.status = 'queued' and j.scheduled_for <= v_now)
          or (
            j.status = 'claimed'
            and j.claimed_at is not null
            and j.claimed_at + make_interval(secs => j.visibility_timeout_seconds) < v_now
          )
        )
      order by j.priority asc, j.scheduled_for asc
      limit p_batch_size
      for update skip locked
  )
  update public.ai_jobs j
    set status                    = 'claimed',
        claimed_at                = v_now,
        claim_token               = gen_random_uuid(),
        attempt                   = j.attempt + 1,
        visibility_timeout_seconds = p_visibility_timeout_seconds,
        updated_at                = v_now
    from ready
    where j.id = ready.id
    returning
      j.id,
      j.user_id,
      j.job_type,
      j.payload,
      j.attempt,
      j.max_attempts,
      j.claim_token;
end;
$$;

comment on function public.claim_ai_jobs(integer, integer) is
  'Claim up to N ready jobs (queued or stuck-claimed). Uses FOR UPDATE SKIP LOCKED for contention-free parallel workers.';

-- ==========================================================================
-- complete_ai_job(p_id, p_claim_token, p_result)
-- ==========================================================================
-- Mark a claimed job succeeded. The claim_token check prevents a stuck
-- worker that wakes up late from clobbering a fresh claim's result.
-- Returns the number of rows updated (0 or 1) so callers can detect
-- token-mismatch / stale ack.
-- ==========================================================================
create or replace function public.complete_ai_job(
  p_id          uuid,
  p_claim_token uuid,
  p_result      jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.ai_jobs
    set status      = 'succeeded',
        result      = coalesce(p_result, result),
        last_error  = null,
        claim_token = null,
        updated_at  = now()
    where id = p_id
      and claim_token = p_claim_token
      and status = 'claimed'
      and kind   = 'queue';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.complete_ai_job(uuid, uuid, jsonb) is
  'Mark a claimed queue job succeeded iff claim_token matches (protects against late wake-ups of abandoned workers). Scoped to kind=''queue''.';

-- ==========================================================================
-- fail_ai_job(p_id, p_claim_token, p_error, p_retry_in_seconds)
-- ==========================================================================
-- Record a failure. If attempt < max_attempts, re-queue with backoff
-- (`scheduled_for = now() + p_retry_in_seconds`). Otherwise move to DLQ.
-- Token-checked for the same reason as complete_ai_job. Returns:
--   0 — stale ack (token mismatch or job not claimed)
--   1 — re-queued for retry
--   2 — moved to DLQ (terminal failure)
-- ==========================================================================
create or replace function public.fail_ai_job(
  p_id                uuid,
  p_claim_token       uuid,
  p_error             text,
  p_retry_in_seconds  integer default 60
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ai_jobs%rowtype;
begin
  select * into v_row
    from public.ai_jobs
    where id = p_id
      and claim_token = p_claim_token
      and status      = 'claimed'
      and kind        = 'queue'
    for update;

  if not found then
    return 0;
  end if;

  if v_row.attempt >= v_row.max_attempts then
    update public.ai_jobs
      set status      = 'dlq',
          dlq_reason  = p_error,
          last_error  = p_error,
          claim_token = null,
          updated_at  = now()
      where id = p_id;
    return 2;
  end if;

  update public.ai_jobs
    set status        = 'queued',
        scheduled_for = now() + make_interval(secs => greatest(p_retry_in_seconds, 1)),
        last_error    = p_error,
        claimed_at    = null,
        claim_token   = null,
        updated_at    = now()
    where id = p_id;
  return 1;
end;
$$;

comment on function public.fail_ai_job(uuid, uuid, text, integer) is
  'Fail a claimed job. Re-queues with backoff until max_attempts exhausted, then moves to DLQ.';

-- ==========================================================================
-- Permissions
-- ==========================================================================
-- All queue functions are service_role-only. Clients never touch the queue
-- directly — they go through `ai-generate` which enforces auth + rate limits.
-- ==========================================================================
revoke all on function public.enqueue_ai_job(uuid, text, jsonb, text, integer, timestamptz, integer) from public;
revoke all on function public.enqueue_ai_job(uuid, text, jsonb, text, integer, timestamptz, integer) from anon, authenticated;

revoke all on function public.claim_ai_jobs(integer, integer) from public;
revoke all on function public.claim_ai_jobs(integer, integer) from anon, authenticated;

revoke all on function public.complete_ai_job(uuid, uuid, jsonb) from public;
revoke all on function public.complete_ai_job(uuid, uuid, jsonb) from anon, authenticated;

revoke all on function public.fail_ai_job(uuid, uuid, text, integer) from public;
revoke all on function public.fail_ai_job(uuid, uuid, text, integer) from anon, authenticated;

-- ==========================================================================
-- Cron: pump the queue every minute
-- ==========================================================================
-- The existing cron jobs (precompute_suggestions, compute_presence, etc.)
-- continue to fire on their own schedules but now ENQUEUE per-user jobs
-- instead of processing serially. A new `ai_jobs_worker` cron pulls from the
-- queue every minute and drains up to N jobs per tick.
--
-- Frequency/concurrency trade-off: minutely × batch=8 = up to 480 jobs/hr
-- per tick, enough to clear a fan-out of ~1k DAU within the same hour's
-- window. Tune `p_batch_size` if the queue grows faster than we drain.
-- ==========================================================================
do $$
begin
  -- Unschedule if exists (idempotent re-run)
  perform cron.unschedule('ai_jobs_worker') where exists (
    select 1 from cron.job where jobname = 'ai_jobs_worker'
  );
exception when others then
  -- ignore — first run, no job yet
  null;
end $$;

select cron.schedule(
  'ai_jobs_worker',
  '* * * * *',
  $$
  select extensions.http_post(
    current_setting('app.settings.edge_function_url', true) || '/ai-generate',
    '{"op": "cron_worker"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);
