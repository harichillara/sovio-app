create extension if not exists postgis;

create table if not exists public.location_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_meters integer,
  locality_bucket text not null,
  sharing_mode text not null default 'approx',
  captured_at timestamptz not null default now(),
  geo_point geography(Point, 4326) generated always as (
    case
      when lat is null or lng is null then null
      else st_setsrid(st_makepoint(lng, lat), 4326)::geography
    end
  ) stored
);

create index if not exists idx_location_snapshots_user_captured
  on public.location_snapshots(user_id, captured_at desc);

create index if not exists idx_location_snapshots_bucket
  on public.location_snapshots(locality_bucket);

create index if not exists idx_location_snapshots_geo
  on public.location_snapshots using gist(geo_point);

alter table public.location_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'location_snapshots'
      and policyname = 'location_snapshots_select_own'
  ) then
    create policy location_snapshots_select_own
      on public.location_snapshots
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'location_snapshots'
      and policyname = 'location_snapshots_insert_own'
  ) then
    create policy location_snapshots_insert_own
      on public.location_snapshots
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.intent_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('google_place', 'predicthq_event', 'social')),
  kind text not null check (kind in ('place', 'event', 'moment')),
  external_id text,
  title text not null,
  summary text,
  lat double precision,
  lng double precision,
  starts_at timestamptz,
  ends_at timestamptz,
  distance_meters integer,
  social_fit_score double precision not null default 0,
  novelty_score double precision not null default 0,
  friction_score double precision not null default 0,
  timing_score double precision not null default 0,
  source_confidence double precision not null default 0,
  rank_score double precision not null default 0,
  payload jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_intent_candidates_user_created
  on public.intent_candidates(user_id, created_at desc);

create index if not exists idx_intent_candidates_user_rank
  on public.intent_candidates(user_id, rank_score desc);

alter table public.intent_candidates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'intent_candidates'
      and policyname = 'intent_candidates_select_own'
  ) then
    create policy intent_candidates_select_own
      on public.intent_candidates
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

alter table public.momentum_availability
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists availability_mode text not null default 'open_now',
  add column if not exists confidence_label text not null default 'open_to_plans',
  add column if not exists source text not null default 'manual',
  add column if not exists geo_point geography(Point, 4326) generated always as (
    case
      when lat is null or lng is null then null
      else st_setsrid(st_makepoint(lng, lat), 4326)::geography
    end
  ) stored;

create index if not exists idx_momentum_availability_geo
  on public.momentum_availability using gist(geo_point);

alter table public.suggestions
  add column if not exists source_label text,
  add column if not exists why_now text,
  add column if not exists candidate_id uuid references public.intent_candidates(id) on delete set null,
  add column if not exists payload jsonb;

create or replace function public.get_nearby_available_friends(
  viewer_id uuid,
  center_lat double precision,
  center_lng double precision,
  radius_meters integer default 2500
)
returns table (
  friend_id uuid,
  display_name text,
  avatar_url text,
  lat double precision,
  lng double precision,
  distance_meters integer,
  category text,
  available_until timestamptz,
  confidence_label text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> viewer_id then
    raise exception 'forbidden';
  end if;

  return query
    with accepted_friends as (
      select f.friend_id as profile_id
      from public.friendships f
      where f.user_id = viewer_id and f.status = 'accepted'
      union
      select f.user_id as profile_id
      from public.friendships f
      where f.friend_id = viewer_id and f.status = 'accepted'
    ),
    center as (
      select st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography as point
    )
    select
      ma.user_id as friend_id,
      p.display_name,
      p.avatar_url,
      ma.lat,
      ma.lng,
      round(st_distance(ma.geo_point, center.point))::integer as distance_meters,
      ma.category,
      ma.available_until,
      ma.confidence_label
    from public.momentum_availability ma
    join accepted_friends af on af.profile_id = ma.user_id
    join public.profiles p on p.id = ma.user_id
    cross join center
    where ma.available_until > now()
      and ma.geo_point is not null
      and st_dwithin(ma.geo_point, center.point, radius_meters)
    order by distance_meters asc, ma.available_until asc;
end;
$$;

grant execute on function public.get_nearby_available_friends(uuid, double precision, double precision, integer)
  to authenticated, service_role;
