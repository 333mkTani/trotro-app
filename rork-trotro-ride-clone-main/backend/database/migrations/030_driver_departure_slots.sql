create table if not exists public.driver_departure_slots (
  id                    uuid primary key default gen_random_uuid(),
  driver_id             uuid not null references public.drivers(id) on delete cascade,
  bus_id                uuid not null references public.buses(id) on delete cascade,
  route_id              uuid not null references public.routes(id),
  departure_stop_id     uuid not null references public.bus_stops(id),
  destination_stop_id   uuid not null references public.bus_stops(id),
  travel_days           text[] not null,
  boarding_start_local  time not null,
  boarding_end_local    time not null,
  timezone              text not null default 'Africa/Accra',
  status                text not null default 'active' check (status in ('active','paused','deleted')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (departure_stop_id <> destination_stop_id),
  check (cardinality(travel_days) between 1 and 7),
  check (travel_days <@ array['mon','tue','wed','thu','fri','sat','sun']::text[]),
  check (boarding_end_local > boarding_start_local)
);

create index if not exists driver_departure_slots_lookup_idx
  on public.driver_departure_slots(route_id, departure_stop_id, destination_stop_id, status);
create index if not exists driver_departure_slots_driver_idx
  on public.driver_departure_slots(driver_id, status, boarding_start_local);
create unique index if not exists driver_departure_slots_unique_active_idx
  on public.driver_departure_slots(driver_id, route_id, departure_stop_id, destination_stop_id,
    boarding_start_local, boarding_end_local, travel_days)
  where status = 'active';

alter table public.commuter_schedules
  add column if not exists departure_slot_id uuid references public.driver_departure_slots(id) on delete restrict;
create index if not exists commuter_schedules_departure_slot_idx
  on public.commuter_schedules(departure_slot_id, status);
