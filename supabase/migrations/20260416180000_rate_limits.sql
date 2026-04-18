-- ==========================================================================
-- Per-user rate limiting (Phase 3, Task 16)
-- ==========================================================================
-- Fixed-window counter, one row per (user_id, bucket). Edge functions call
-- `consume_rate_limit(...)` via the service_role key — RLS blocks direct
-- client access. The function atomically reads-modifies-writes under row
-- lock, so concurrent requests from the same user can't exceed the cap by
-- interleaving.
--
-- Why fixed-window, not true sliding-window?
-- Sliding windows require either (a) storing one row per request (expensive
-- at scale) or (b) approximating via two counters. Fixed-window has the
-- classic "2x burst at the boundary" weakness but is dramatically cheaper:
-- one row per user per bucket, one UPDATE per request. For our use case
-- (abuse prevention on expensive LLM calls, not precision pacing) that's
-- the right trade.
--
-- Buckets:
--   'ai-generate' — LLM generation calls (60/hr free, 600/hr pro)
-- Additional buckets can be added without schema changes; callers pass
-- their own (p_bucket, p_max, p_window_seconds).
-- ==========================================================================

create table if not exists public.rate_limit_buckets (
  user_id        uuid        not null,
  bucket         text        not null,
  window_start   timestamptz not null default now(),
  request_count  integer     not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, bucket)
);

-- Hot query path is the primary key; no secondary indexes needed.

-- Deny-by-default for clients. Only service_role (which bypasses RLS) may
-- read or write — edge functions call `consume_rate_limit` via RPC with the
-- service_role key.
alter table public.rate_limit_buckets enable row level security;
-- No policies intentionally — deny-by-default.

-- ==========================================================================
-- consume_rate_limit(user_id, bucket, max, window_seconds)
-- ==========================================================================
-- Atomically decide whether this request is within the per-user cap, and
-- record it if so. Returns one row describing the outcome:
--   allowed     — true if the request may proceed
--   used        — request count in the current window INCLUDING this call
--                 (for allowed=true) or EXCLUDING it (for allowed=false)
--   remaining   — requests left in the window (0 when allowed=false)
--   reset_at    — wall-clock time when the window ends and counters reset
-- ==========================================================================
create or replace function public.consume_rate_limit(
  p_user_id        uuid,
  p_bucket         text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, used integer, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now      timestamptz := now();
  v_interval interval   := make_interval(secs => p_window_seconds);
  v_row      public.rate_limit_buckets%rowtype;
begin
  if p_max <= 0 or p_window_seconds <= 0 then
    raise exception 'consume_rate_limit: p_max and p_window_seconds must be positive';
  end if;

  -- Lock the per-user-per-bucket row (or note absence) to serialize concurrent
  -- requests for the same user. Different users don't contend.
  select * into v_row
    from public.rate_limit_buckets
    where user_id = p_user_id and bucket = p_bucket
    for update;

  -- First request ever in this bucket for this user.
  if not found then
    insert into public.rate_limit_buckets(user_id, bucket, window_start, request_count, updated_at)
      values (p_user_id, p_bucket, v_now, 1, v_now)
      -- ON CONFLICT path handles the race where two concurrent callers pass
      -- the `not found` branch before either insert commits.
      on conflict (user_id, bucket) do update
        set request_count = public.rate_limit_buckets.request_count + 1,
            updated_at    = v_now
      returning * into v_row;

    return query
      select true,
             v_row.request_count,
             greatest(p_max - v_row.request_count, 0),
             v_row.window_start + v_interval;
    return;
  end if;

  -- Window expired — reset the counter to 1 (this request).
  if v_now >= v_row.window_start + v_interval then
    update public.rate_limit_buckets
      set window_start  = v_now,
          request_count = 1,
          updated_at    = v_now
      where user_id = p_user_id and bucket = p_bucket
      returning * into v_row;

    return query
      select true,
             1::integer,
             (p_max - 1),
             v_row.window_start + v_interval;
    return;
  end if;

  -- Still within window, already at the cap — deny.
  if v_row.request_count >= p_max then
    return query
      select false,
             v_row.request_count,
             0::integer,
             v_row.window_start + v_interval;
    return;
  end if;

  -- Still within window, under the cap — allow and increment.
  update public.rate_limit_buckets
    set request_count = request_count + 1,
        updated_at    = v_now
    where user_id = p_user_id and bucket = p_bucket
    returning * into v_row;

  return query
    select true,
           v_row.request_count,
           greatest(p_max - v_row.request_count, 0),
           v_row.window_start + v_interval;
end;
$$;

comment on function public.consume_rate_limit(uuid, text, integer, integer) is
  'Atomic fixed-window rate-limit check. Callable only by service_role (client access blocked by default RLS on rate_limit_buckets). Returns (allowed, used, remaining, reset_at).';

-- Service role only; clients and the authenticated role never call this directly.
revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public;
revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from anon, authenticated;
-- service_role keeps its implicit grants via the supabase role hierarchy.
