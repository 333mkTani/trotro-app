-- Roll back migration 023. Apply manually only when the scheduling rollout
-- must be removed; normal migration runners intentionally ignore this folder.
begin;

drop table if exists public.schedule_notification_jobs;
drop table if exists public.future_reservations;
drop table if exists public.driver_schedule_responses;
drop table if exists public.schedule_occurrences;
drop table if exists public.commuter_schedules;

drop type if exists public.future_reservation_status;
drop type if exists public.schedule_response_status;
drop type if exists public.schedule_occurrence_status;
drop type if exists public.commuter_schedule_status;

commit;
