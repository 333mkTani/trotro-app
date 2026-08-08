-- Expand the idempotent outbox for boarding and recovery lifecycle events.
alter table public.schedule_notification_jobs
  drop constraint if exists schedule_notification_jobs_event_type_check;
alter table public.schedule_notification_jobs
  add constraint schedule_notification_jobs_event_type_check check (event_type in (
    'schedule_offer', 'schedule_reminder', 'schedule_reopened',
    'schedule_accepted', 'schedule_driver_withdrawn', 'schedule_unmatched',
    'schedule_backup_started', 'schedule_backup_stopped',
    'schedule_boarding_open', 'schedule_boarding_reminder', 'schedule_boarding_closed',
    'schedule_cancelled', 'schedule_expired'
  ));

create table if not exists public.schedule_in_app_notifications (
  id             uuid primary key default gen_random_uuid(),
  occurrence_id  uuid not null references public.schedule_occurrences(id) on delete cascade,
  recipient_id   uuid not null references public.profiles(id) on delete cascade,
  event_type     text not null,
  title          text not null,
  body           text not null,
  payload        jsonb not null default '{}'::jsonb,
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (occurrence_id, recipient_id, event_type)
);

create index if not exists schedule_in_app_notifications_recipient_idx
  on public.schedule_in_app_notifications(recipient_id, created_at desc);
