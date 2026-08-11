-- Retain the last reliable course while a bus is temporarily stationary.
alter table public.buses
  add column if not exists movement_heading_deg double precision,
  add column if not exists direction_observed_at timestamptz;

alter table public.buses drop constraint if exists buses_movement_heading_check;
alter table public.buses
  add constraint buses_movement_heading_check
  check (movement_heading_deg is null or (movement_heading_deg >= 0 and movement_heading_deg < 360));
