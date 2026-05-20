-- Bookings
create table if not exists public.bookings (
  id                     uuid primary key default gen_random_uuid(),
  passenger_id           uuid not null references public.profiles(id) on delete cascade,
  driver_id              uuid references public.drivers(id)           on delete set null,
  bus_id                 uuid references public.buses(id)             on delete set null,
  route_id               uuid references public.routes(id)            on delete set null,

  pickup_stop_id         uuid not null references public.bus_stops(id),
  pickup_stop_name       text not null,
  destination_stop_id    uuid not null references public.bus_stops(id),
  destination_stop_name  text not null,

  desired_arrival_time   timestamptz not null,
  buffer_minutes         integer not null check (buffer_minutes in (10, 15, 20)),

  status                 booking_status not null default 'pending',
  notification_sent_at   timestamptz,
  confirmed_at           timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,

  route_name             text,
  ride_fare              numeric(8,2),
  ride_payment_method    ride_payment_method,

  -- Optional recurring schedule { days, time_mode, same_hour, same_minute, custom_times }
  ride_schedule          jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists bookings_passenger_idx on public.bookings(passenger_id, created_at desc);
create index if not exists bookings_driver_idx    on public.bookings(driver_id);
create index if not exists bookings_status_idx    on public.bookings(status);
