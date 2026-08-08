alter table public.bus_alert_notification_jobs
  drop constraint if exists bus_alert_notification_jobs_status_check;
alter table public.bus_alert_notification_jobs
  add constraint bus_alert_notification_jobs_status_check
  check (status in ('pending','processing','sent','cancelled','dead_letter'));
create index if not exists bus_alert_notification_jobs_dead_letter_idx
  on public.bus_alert_notification_jobs(status, created_at)
  where status = 'dead_letter';
