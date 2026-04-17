alter table public.momentum_availability
  add column if not exists category text;

alter table public.suggestions
  add column if not exists confidence double precision not null default 0.6,
  add column if not exists dismiss_reason text,
  add column if not exists source_label text,
  add column if not exists why_now text,
  add column if not exists payload jsonb;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'suggestions'
      and column_name = 'candidate_id'
  ) then
    alter table public.suggestions
      add column candidate_id uuid references public.intent_candidates(id) on delete set null;
  end if;
end $$;

alter table public.entitlements
  add column if not exists id uuid,
  add column if not exists current_period_end timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists daily_ai_calls_used integer default 0,
  add column if not exists daily_ai_calls_reset_at timestamptz default (date_trunc('day', now()) + interval '1 day'),
  add column if not exists created_at timestamptz default now();

update public.entitlements
set id = coalesce(id, gen_random_uuid()),
    daily_ai_calls_used = coalesce(daily_ai_calls_used, 0),
    daily_ai_calls_reset_at = coalesce(daily_ai_calls_reset_at, date_trunc('day', now()) + interval '1 day'),
    created_at = coalesce(created_at, now())
where id is null
   or daily_ai_calls_used is null
   or daily_ai_calls_reset_at is null
   or created_at is null;

alter table public.entitlements
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column daily_ai_calls_used set default 0,
  alter column daily_ai_calls_used set not null,
  alter column daily_ai_calls_reset_at set default (date_trunc('day', now()) + interval '1 day'),
  alter column daily_ai_calls_reset_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entitlements'::regclass
      and contype = 'p'
  ) then
    alter table public.entitlements
      add constraint entitlements_pkey primary key (id);
  end if;
end $$;

create unique index if not exists idx_entitlements_user_id
  on public.entitlements(user_id);
