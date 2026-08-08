drop table if exists public.bus_alert_in_app_notifications;
drop table if exists public.bus_alert_notification_jobs;
drop table if exists public.bus_alert_trigger_occurrences;
alter table public.bus_alerts drop column if exists timezone;
