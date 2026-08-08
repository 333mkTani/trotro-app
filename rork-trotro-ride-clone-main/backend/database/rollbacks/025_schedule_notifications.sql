begin;
drop table if exists public.schedule_in_app_notifications;
alter table public.schedule_notification_jobs drop constraint if exists schedule_notification_jobs_event_type_check;
alter table public.schedule_notification_jobs add constraint schedule_notification_jobs_event_type_check check (event_type in (
  'schedule_offer','schedule_reminder','schedule_reopened','schedule_accepted','schedule_driver_withdrawn','schedule_unmatched'
));
commit;
