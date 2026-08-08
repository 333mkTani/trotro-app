drop index if exists public.bus_alert_notification_jobs_dead_letter_idx;
update public.bus_alert_notification_jobs set status = 'cancelled' where status = 'dead_letter';
alter table public.bus_alert_notification_jobs
  drop constraint if exists bus_alert_notification_jobs_status_check;
alter table public.bus_alert_notification_jobs
  add constraint bus_alert_notification_jobs_status_check
  check (status in ('pending','processing','sent','cancelled'));
