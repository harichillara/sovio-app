-- ==========================================================================
-- Notification pacing and tone tuning
-- ==========================================================================
-- Keep the bell and push layer useful by widening dedup windows and softening
-- a few system phrases to feel more deliberate.

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
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user_id, p_kind, p_title, p_body, p_data)
  returning id into v_notification_id;

  v_dedup_window := case
    when p_kind = 'message' then interval '2 minutes'
    when p_kind = 'match' then interval '10 minutes'
    when p_kind = 'insight' then interval '18 hours'
    else interval '45 minutes'
  end;

  select exists(
    select 1 from public.notifications
    where user_id = p_user_id
      and kind = p_kind
      and id != v_notification_id
      and push_sent = true
      and created_at > now() - v_dedup_window
  ) into v_recent_exists;

  if v_recent_exists then
    return v_notification_id;
  end if;

  v_edge_url := coalesce(
    current_setting('app.settings.edge_function_url', true),
    ''
  );
  v_service_key := coalesce(
    current_setting('app.settings.service_role_key', true),
    ''
  );

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

    update public.notifications
    set push_sent = true
    where id = v_notification_id;
  end if;

  return v_notification_id;
end;
$$;

create or replace function public.trg_notify_replay_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select
      nr.user_id,
      count(*)::integer as replay_count,
      max(coalesce(nr.reason, 'Take another look at what you missed.')) as preview_reason
    from new_rows nr
    group by nr.user_id
  loop
    perform public.notify_insert_and_push(
      v_row.user_id,
      'replay',
      case
        when v_row.replay_count = 1 then 'Worth another look'
        else 'A few moments are worth another look'
      end,
      left(v_row.preview_reason, 120),
      jsonb_build_object(
        'route', '/(tabs)/replay',
        'replayCount', v_row.replay_count
      )
    );
  end loop;

  return null;
end;
$$;

create or replace function public.trg_notify_weekly_insight()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
     and NEW.insight is not distinct from OLD.insight
     and NEW.experiment is not distinct from OLD.experiment
     and NEW.week_of is not distinct from OLD.week_of then
    return NEW;
  end if;

  perform public.notify_insert_and_push(
    NEW.user_id,
    'insight',
    'Your weekly pattern is ready',
    left(NEW.insight, 120),
    jsonb_build_object(
      'route', '/(modals)/weekly-insight',
      'weekOf', NEW.week_of
    )
  );

  return NEW;
end;
$$;
