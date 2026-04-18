-- ==========================================================================
-- Notification triggers for replay + weekly insights
-- ==========================================================================
-- Messages already notify at the DB layer. This migration closes the gap for
-- other async product surfaces so the bell and push system are driven by the
-- same domain events instead of parallel edge-function bookkeeping.

-- ---------------------------------------------------------------------------
-- Replay batches -> one notification per user per insert statement
-- ---------------------------------------------------------------------------
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
        when v_row.replay_count = 1 then 'Missed moment ready'
        else 'Missed moments are back'
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

drop trigger if exists trg_notify_replay_batch on public.missed_moments;

create trigger trg_notify_replay_batch
  after insert on public.missed_moments
  referencing new table as new_rows
  for each statement
  execute function public.trg_notify_replay_batch();

-- ---------------------------------------------------------------------------
-- Weekly insights -> notify on insert and on meaningful weekly refreshes
-- ---------------------------------------------------------------------------
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
    'Your weekly insight is here',
    left(NEW.insight, 120),
    jsonb_build_object(
      'route', '/(modals)/weekly-insight',
      'weekOf', NEW.week_of
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_weekly_insight on public.weekly_insights;

create trigger trg_notify_weekly_insight
  after insert or update on public.weekly_insights
  for each row
  execute function public.trg_notify_weekly_insight();
