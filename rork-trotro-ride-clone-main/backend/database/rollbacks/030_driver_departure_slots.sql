drop index if exists public.commuter_schedules_departure_slot_idx;
alter table public.commuter_schedules drop column if exists departure_slot_id;
drop table if exists public.driver_departure_slots;

