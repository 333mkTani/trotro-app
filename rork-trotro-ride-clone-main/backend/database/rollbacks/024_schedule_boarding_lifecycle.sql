begin;
drop table if exists public.schedule_no_shows;
drop table if exists public.schedule_boarding_codes;
alter table public.bookings drop column if exists source_occurrence_id;
commit;
