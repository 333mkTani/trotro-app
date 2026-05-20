-- Drivers and Buses
create table if not exists public.drivers (
  id              uuid primary key references public.users(id) on delete cascade,
  full_name       text not null,
  phone           text unique not null,
  license_number  text,
  rating_avg      numeric(3,2) not null default 0,
  rating_count    integer not null default 0,
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now()
);

create table if not exists public.buses (
  id                 uuid primary key default gen_random_uuid(),
  registration       text unique not null,
  driver_id          uuid references public.drivers(id) on delete set null,
  route_id           uuid references public.routes(id)  on delete set null,
  total_seats        integer not null default 14,
  seats_available    integer not null default 14,
  current_lat        double precision,
  current_lng        double precision,
  last_ping_at       timestamptz,
  status             entity_status not null default 'active',
  created_at         timestamptz not null default now()
);
create index if not exists buses_driver_idx on public.buses(driver_id);
create index if not exists buses_route_idx  on public.buses(route_id);
