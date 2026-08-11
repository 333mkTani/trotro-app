-- Persistent route movement state derived from consecutive driver GPS fixes.
alter table public.buses
  add column if not exists route_direction text not null default 'unknown',
  add column if not exists route_progress_m double precision,
  add column if not exists route_offset_m double precision,
  add column if not exists movement_speed_mps double precision,
  add column if not exists direction_confidence integer not null default 0;

alter table public.buses drop constraint if exists buses_route_direction_check;
alter table public.buses
  add constraint buses_route_direction_check
  check (route_direction in ('unknown', 'forward', 'reverse'));

create index if not exists buses_route_progress_idx
  on public.buses(route_id, route_direction, route_progress_m)
  where status = 'active' and driving_status = 'EN_ROUTE';
