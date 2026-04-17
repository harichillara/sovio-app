create table if not exists public.beta_pro_allowlist (
  email text primary key,
  plan text not null default 'pro' check (plan in ('free', 'pro')),
  pro_until timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_beta_pro_allowlist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists beta_pro_allowlist_touch_updated_at on public.beta_pro_allowlist;

create trigger beta_pro_allowlist_touch_updated_at
before update on public.beta_pro_allowlist
for each row
execute function public.touch_beta_pro_allowlist_updated_at();

create or replace function public.apply_beta_pro_access(target_user_id uuid, target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  allow_entry public.beta_pro_allowlist%rowtype;
begin
  if normalized_email is null or normalized_email = '' then
    return;
  end if;

  select *
  into allow_entry
  from public.beta_pro_allowlist
  where lower(email) = normalized_email;

  if not found then
    return;
  end if;

  insert into public.entitlements (
    user_id,
    plan,
    status,
    pro_until,
    current_period_end,
    daily_ai_calls_used,
    daily_ai_calls_reset_at
  )
  values (
    target_user_id,
    allow_entry.plan,
    'active',
    allow_entry.pro_until,
    allow_entry.pro_until,
    0,
    date_trunc('day', now()) + interval '1 day'
  )
  on conflict (user_id) do update
  set
    plan = excluded.plan,
    status = 'active',
    pro_until = greatest(coalesce(public.entitlements.pro_until, excluded.pro_until), excluded.pro_until),
    current_period_end = greatest(coalesce(public.entitlements.current_period_end, excluded.current_period_end), excluded.current_period_end);

  update public.profiles
  set subscription_tier = allow_entry.plan
  where id = target_user_id;
end;
$$;

create or replace function public.handle_beta_pro_allowlist_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_beta_pro_access(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists profiles_apply_beta_pro_allowlist on public.profiles;

create trigger profiles_apply_beta_pro_allowlist
after insert or update of email on public.profiles
for each row
execute function public.handle_beta_pro_allowlist_profile();

do $$
declare
  profile_row record;
begin
  for profile_row in
    select id, email
    from public.profiles
  loop
    perform public.apply_beta_pro_access(profile_row.id, profile_row.email);
  end loop;
end;
$$;
