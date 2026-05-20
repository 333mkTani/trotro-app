-- Aggregated stop demand and global scheduling rules
create table if not exists public.stop_demand (
  stop_id         uuid primary key references public.bus_stops(id) on delete cascade,
  demand_count    integer not null default 0,
  updated_at      timestamptz not null default now()
);

create table if not exists public.scheduling_rules (
  id                       integer primary key default 1 check (id = 1),
  booking_window_start     time not null default '03:00',
  booking_window_end       time not null default '08:00',
  min_advance_minutes      integer not null default 45,
  notification_trigger_km  numeric(5,2) not null default 2.0,
  allowed_buffer_options   integer[] not null default '{10,15,20}'
);

insert into public.scheduling_rules (id) values (1)
on conflict (id) do nothing;
