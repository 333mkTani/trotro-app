-- Bus stops, routes, and route ↔ stop ordering
create table if not exists public.bus_stops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            bus_stop_type not null default 'stop',
  lat             double precision not null,
  lng             double precision not null,
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now()
);
create index if not exists bus_stops_status_idx on public.bus_stops(status);

create table if not exists public.routes (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  origin          text not null,
  destination     text not null,
  distance_km     numeric(6,2) not null,
  duration_min    integer not null,
  fare            numeric(8,2) not null,
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now()
);

create table if not exists public.route_stops (
  route_id        uuid not null references public.routes(id) on delete cascade,
  stop_id         uuid not null references public.bus_stops(id) on delete restrict,
  sequence        integer not null,
  primary key (route_id, sequence),
  unique (route_id, stop_id)
);
