-- ==========================================================================
-- Notifications Table + Push Delivery Infrastructure
-- ==========================================================================
-- Creates a unified notifications table that serves as the single source
-- of truth for both the in-app bell and push delivery. Includes:
--   1. notifications table with RLS
--   2. notify_insert_and_push() SQL function (insert + push dispatch)
--   3. AFTER INSERT trigger on messages for automatic message push
-- ==========================================================================

-- Ensure pg_net is available (already created in cron_jobs migration)
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. notifications table
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('suggestion', 'message', 'replay', 'insight', 'match')),
  title       text not null,
  body        text not null default '',
  data        jsonb default '{}'::jsonb,
  read        boolean not null default false,
  push_sent   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Index for badge count (unread notifications per user)
create index idx_notifications_user_unread
  on public.notifications (user_id)
  where read = false;

-- Index for feed (newest first per user)
create index idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- Index for deduplication check (recent same-kind per user)
create index idx_notifications_dedup
  on public.notifications (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: users can read & mark-read their own; service role inserts
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role can insert notifications"
  on public.notifications for insert
  with check (true);

-- ---------------------------------------------------------------------------
-- 2. notify_insert_and_push() — central notification creation + push dispatch
-- ---------------------------------------------------------------------------
-- Inserts a notification row, then fires an async HTTP call to the notify
-- Edge Function via pg_net. Deduplicates: if a notification with the same
-- (user_id, kind) was created in the last 5 minutes, the row is still
-- inserted but push is skipped (prevents duplicate buzzes from cron retries).
--
-- For 'message' kind, dedup window is 30 seconds (messages are more granular).
-- ---------------------------------------------------------------------------
create or replace function public.notify_insert_and_push(
  p_user_id   uuid,
  p_kind      text,
  p_title     text,
  p_body      text default '',
  p_data      jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
  v_recent_exists   boolean;
  v_dedup_window    interval;
  v_edge_url        text;
  v_service_key     text;
begin
  -- Insert the notification row (always)
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user_id, p_kind, p_title, p_body, p_data)
  returning id into v_notification_id;

  -- Dedup window: 30s for messages, 5min for everything else
  v_dedup_window := case when p_kind = 'message' then interval '30 seconds'
                         else interval '5 minutes' end;

  -- Check if a DIFFERENT notification of the same kind was sent recently
  select exists(
    select 1 from public.notifications
    where user_id = p_user_id
      and kind = p_kind
      and id != v_notification_id
      and push_sent = true
      and created_at > now() - v_dedup_window
  ) into v_recent_exists;

  -- If recent push exists, skip push but keep the notification row
  if v_recent_exists then
    return v_notification_id;
  end if;

  -- Dispatch push via pg_net → notify Edge Function
  v_edge_url := coalesce(
    current_setting('app.settings.edge_function_url', true),
    ''
  );
  v_service_key := coalesce(
    current_setting('app.settings.service_role_key', true),
    ''
  );

  -- Only attempt push if we have the Edge Function URL configured
  if v_edge_url != '' and v_service_key != '' then
    perform net.http_post(
      url := v_edge_url || '/notify',
      body := jsonb_build_object(
        'userIds', jsonb_build_array(p_user_id::text),
        'title', p_title,
        'body', p_body,
        'data', p_data || jsonb_build_object('notificationId', v_notification_id::text),
        'channel', p_kind
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      )
    );

    -- Mark push as sent (fire-and-forget — we assume the Edge Function will process it)
    update public.notifications
    set push_sent = true
    where id = v_notification_id;
  end if;

  return v_notification_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Message trigger — auto-notify on new real messages
-- ---------------------------------------------------------------------------
-- Fires for every non-AI-draft message insert. Sends a push notification
-- to each thread participant except the sender.
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_recipient   record;
begin
  -- Look up sender display name
  select display_name into v_sender_name
  from public.profiles
  where id = NEW.sender_id;

  -- Notify each thread participant except the sender
  for v_recipient in
    select tp.user_id
    from public.thread_participants tp
    where tp.thread_id = NEW.thread_id
      and tp.user_id != NEW.sender_id
  loop
    perform public.notify_insert_and_push(
      v_recipient.user_id,
      'message',
      'New message from ' || coalesce(v_sender_name, 'someone'),
      left(NEW.content, 120),
      jsonb_build_object(
        'route', '/(modals)/thread-detail',
        'threadId', NEW.thread_id,
        'messageId', NEW.id
      )
    );
  end loop;

  return NEW;
end;
$$;

create trigger trg_notify_new_message
  after insert on public.messages
  for each row
  when (NEW.is_ai_draft = false)
  execute function public.trg_notify_new_message();

-- ---------------------------------------------------------------------------
-- 4. Enable realtime on notifications table (for instant bell updates)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
