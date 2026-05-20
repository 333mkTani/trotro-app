-- Bus alerts (one-off + recurring schedule)
create table if not exists public.bus_alerts (
  id                    uuid primary key default gen_random_uuid(),
  passenger_id          uuid not null references public.profiles(id) on delete cascade,
  route_id              uuid references public.routes(id)            on delete set null,
  route_name            text not null,
  stop_id               uuid not null references public.bus_stops(id),
  stop_name             text not null,
  alert_time            timestamptz,
  schedule              jsonb,
  is_active             boolean not null default true,
  triggered             boolean not null default false,
  last_triggered_day    date,
  triggered_buses       jsonb,
  created_at            timestamptz not null default now()
);
create index if not exists bus_alerts_passenger_idx on public.bus_alerts(passenger_id);
create index if not exists bus_alerts_active_idx    on public.bus_alerts(is_active);
