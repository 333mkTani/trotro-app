-- =========================================================================
-- Consolidated Supabase schema for the bus-booking app.
-- Paste this entire file into the Supabase SQL editor and run it once.
-- It is idempotent: safe to re-run.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Extensions and ENUM types
-- -------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "postgis";

do $$ begin
  create type user_role            as enum ('passenger', 'admin', 'driver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status       as enum ('pending', 'confirmed', 'completed', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bus_stop_type        as enum ('stop', 'station');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entity_status        as enum ('active', 'paused', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type code_status          as enum ('valid', 'used', 'expired', 'invalidated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type     as enum ('top_up', 'ride_payment', 'driver_payment', 'refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_status   as enum ('completed', 'pending', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ride_payment_method  as enum ('wallet', 'cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method       as enum ('momo_mtn', 'momo_vodafone', 'momo_airteltigo', 'card', 'bank');
exception when duplicate_object then null; end $$;

do $$ begin
  create type schedule_time_mode   as enum ('same', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_mode           as enum ('system', 'light', 'dark');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------
-- 2. Users + Profiles
--    Note: with Supabase Auth, public.users mirrors the user record we
--    manage ourselves; profiles links to it 1:1. If you switch to the
--    built-in auth.users table later, swap the FK target on profiles.
-- -------------------------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  phone           text unique not null,
  email           text unique,
  password_hash   text not null,
  is_verified     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists users_phone_idx on public.users(phone);

create table if not exists public.profiles (
  id              uuid primary key references public.users(id) on delete cascade,
  phone           text unique not null,
  full_name       text not null,
  email           text,
  avatar_url      text,
  role            user_role not null default 'passenger',
  fcm_token       text,
  theme_mode      theme_mode not null default 'system',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

-- -------------------------------------------------------------------------
-- 3. Bus stops, routes, route ↔ stop ordering
-- -------------------------------------------------------------------------
create table if not exists public.bus_stops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            bus_stop_type not null default 'stop',
  lat             double precision not null,
  lng             double precision not null,
  geom            geography(Point, 4326),
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now()
);
create index if not exists bus_stops_status_idx on public.bus_stops(status);
create index if not exists bus_stops_geom_idx   on public.bus_stops using gist (geom);

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

-- -------------------------------------------------------------------------
-- 4. Drivers and Buses
-- -------------------------------------------------------------------------
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
  geom               geography(Point, 4326),
  last_ping_at       timestamptz,
  status             entity_status not null default 'active',
  created_at         timestamptz not null default now()
);
create index if not exists buses_driver_idx on public.buses(driver_id);
create index if not exists buses_route_idx  on public.buses(route_id);
create index if not exists buses_geom_idx   on public.buses using gist (geom);

-- -------------------------------------------------------------------------
-- 5. Bookings
-- -------------------------------------------------------------------------
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

-- -------------------------------------------------------------------------
-- 6. Verification codes (boarding pass + QR)
-- -------------------------------------------------------------------------
create table if not exists public.verification_codes (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null unique references public.bookings(id) on delete cascade,
  code               text not null unique,
  qr_payload         text,
  status             code_status not null default 'valid',
  valid_until        timestamptz not null,
  used_at            timestamptz,
  invalidated_at     timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists verification_codes_status_idx on public.verification_codes(status);

-- -------------------------------------------------------------------------
-- 7. Bus alerts (one-off + recurring schedule)
-- -------------------------------------------------------------------------
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

-- -------------------------------------------------------------------------
-- 8. Wallets and signed transactions
-- -------------------------------------------------------------------------
create table if not exists public.wallets (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  balance        numeric(10,2) not null default 0,
  updated_at     timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  booking_id        uuid references public.bookings(id) on delete set null,
  type              transaction_type not null,
  amount            numeric(10,2) not null,
  description       text not null,
  status            transaction_status not null default 'completed',
  payment_method    payment_method,
  reference         text,
  created_at        timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx   on public.wallet_transactions(user_id, created_at desc);
create index if not exists wallet_tx_status_idx on public.wallet_transactions(status);

-- -------------------------------------------------------------------------
-- 9. Driver ratings (1 per booking)
-- -------------------------------------------------------------------------
create table if not exists public.driver_ratings (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings(id) on delete cascade,
  passenger_id    uuid not null references public.profiles(id) on delete cascade,
  driver_id       uuid not null references public.drivers(id)  on delete cascade,
  rating          integer not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now()
);
create index if not exists driver_ratings_driver_idx on public.driver_ratings(driver_id);

-- -------------------------------------------------------------------------
-- 10. Aggregated stop demand and global scheduling rules
-- -------------------------------------------------------------------------
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

-- -------------------------------------------------------------------------
-- 11. Triggers: updated_at + auto-provision wallet on profile insert
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_users_updated     on public.users;
drop trigger if exists trg_profiles_updated  on public.profiles;
drop trigger if exists trg_bookings_updated  on public.bookings;
drop trigger if exists trg_wallets_updated   on public.wallets;

create trigger trg_users_updated     before update on public.users     for each row execute function public.set_updated_at();
create trigger trg_profiles_updated  before update on public.profiles  for each row execute function public.set_updated_at();
create trigger trg_bookings_updated  before update on public.bookings  for each row execute function public.set_updated_at();
create trigger trg_wallets_updated   before update on public.wallets   for each row execute function public.set_updated_at();

-- Spatial sync triggers ---------------------------------------------------
create or replace function public.bus_stops_sync_geom()
returns trigger language plpgsql as $
begin
  if new.lat is not null and new.lng is not null then
    new.geom = ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end $;

drop trigger if exists trg_bus_stops_geom on public.bus_stops;
create trigger trg_bus_stops_geom
  before insert or update of lat, lng on public.bus_stops
  for each row execute function public.bus_stops_sync_geom();

create or replace function public.buses_sync_geom()
returns trigger language plpgsql as $
begin
  if new.current_lat is not null and new.current_lng is not null then
    new.geom = ST_SetSRID(ST_MakePoint(new.current_lng, new.current_lat), 4326)::geography;
  else
    new.geom = null;
  end if;
  return new;
end $;

drop trigger if exists trg_buses_geom on public.buses;
create trigger trg_buses_geom
  before insert or update of current_lat, current_lng on public.buses
  for each row execute function public.buses_sync_geom();

create or replace function public.handle_new_profile()
returns trigger language plpgsql as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_profile_created on public.profiles;
create trigger trg_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- -------------------------------------------------------------------------
-- 12. Reference seed data (idempotent)
-- -------------------------------------------------------------------------
insert into public.bus_stops (id, name, type, lat, lng) values
  ('11111111-1111-1111-1111-111111111111', 'Accra Central',     'station', 5.5502, -0.2174),
  ('22222222-2222-2222-2222-222222222222', 'Kwame Nkrumah Cir', 'station', 5.5710, -0.2070),
  ('33333333-3333-3333-3333-333333333333', '37 Station',        'station', 5.5860, -0.1850),
  ('44444444-4444-4444-4444-444444444444', 'Madina Market',     'station', 5.6830, -0.1660)
on conflict (id) do nothing;

insert into public.routes (id, name, origin, destination, distance_km, duration_min, fare) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Circle → Madina', 'Kwame Nkrumah Circle', 'Madina', 14.50, 45, 6.00)
on conflict (id) do nothing;

insert into public.route_stops (route_id, stop_id, sequence) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 3)
on conflict do nothing;
