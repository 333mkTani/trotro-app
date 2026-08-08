-- Server-authoritative, idempotent bus-alert trigger and delivery pipeline.
alter table public.bus_alerts
  add column if not exists timezone text not null default 'Africa/Accra';

create table if not exists public.bus_alert_trigger_occurrences (
  id             uuid primary key default gen_random_uuid(),
  alert_id       uuid not null references public.bus_alerts(id) on delete cascade,
  passenger_id   uuid not null references public.profiles(id) on delete cascade,
  local_date     date not null,
  scheduled_for  timestamptz not null,
  status         text not null default 'pending'
                   check (status in ('pending','delivered','cancelled')),
  buses          jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  delivered_at   timestamptz,
  unique (alert_id, local_date)
);

create index if not exists bus_alert_trigger_occurrences_status_idx
  on public.bus_alert_trigger_occurrences(status, scheduled_for);

create table if not exists public.bus_alert_notification_jobs (
  id                    uuid primary key default gen_random_uuid(),
  trigger_occurrence_id uuid not null references public.bus_alert_trigger_occurrences(id) on delete cascade,
  recipient_id          uuid not null references public.profiles(id) on delete cascade,
  status                text not null default 'pending'
                          check (status in ('pending','processing','sent','cancelled')),
  attempts              smallint not null default 0,
  processing_started_at timestamptz,
  next_attempt_at       timestamptz not null default now(),
  last_error            text,
  created_at            timestamptz not null default now(),
  sent_at               timestamptz,
  unique (trigger_occurrence_id, recipient_id)
);

create index if not exists bus_alert_notification_jobs_pending_idx
  on public.bus_alert_notification_jobs(status, next_attempt_at, created_at);

create table if not exists public.bus_alert_in_app_notifications (
  id                    uuid primary key default gen_random_uuid(),
  trigger_occurrence_id uuid not null unique references public.bus_alert_trigger_occurrences(id) on delete cascade,
  alert_id              uuid not null references public.bus_alerts(id) on delete cascade,
  recipient_id          uuid not null references public.profiles(id) on delete cascade,
  title                 text not null,
  body                  text not null,
  payload               jsonb not null default '{}'::jsonb,
  read_at               timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists bus_alert_in_app_notifications_recipient_idx
  on public.bus_alert_in_app_notifications(recipient_id, created_at desc);
