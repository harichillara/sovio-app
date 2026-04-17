create or replace function public.get_thread_summaries()
returns table (
  thread_id uuid,
  plan_id uuid,
  title text,
  thread_created_at timestamptz,
  latest_message_id uuid,
  latest_message_sender_id uuid,
  latest_message_content text,
  latest_message_is_ai_draft boolean,
  latest_message_created_at timestamptz,
  unread_count bigint
)
language sql
security invoker
set search_path = public
as $$
  with my_threads as (
    select
      tp.thread_id,
      tp.last_read_at
    from public.thread_participants tp
    where tp.user_id = auth.uid()
  )
  select
    t.id as thread_id,
    t.plan_id,
    t.title,
    t.created_at as thread_created_at,
    lm.id as latest_message_id,
    lm.sender_id as latest_message_sender_id,
    lm.content as latest_message_content,
    lm.is_ai_draft as latest_message_is_ai_draft,
    lm.created_at as latest_message_created_at,
    coalesce(uc.unread_count, 0) as unread_count
  from my_threads mt
  join public.threads t
    on t.id = mt.thread_id
  left join lateral (
    select
      m.id,
      m.sender_id,
      m.content,
      m.is_ai_draft,
      m.created_at
    from public.messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages m
    where m.thread_id = t.id
      and (
        mt.last_read_at is null
        or m.created_at > mt.last_read_at
      )
  ) uc on true
  order by coalesce(lm.created_at, t.created_at) desc;
$$;

create index if not exists messages_thread_id_created_at_idx
  on public.messages (thread_id, created_at desc);

create index if not exists thread_participants_user_id_thread_id_idx
  on public.thread_participants (user_id, thread_id);
