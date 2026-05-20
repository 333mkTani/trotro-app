-- =====================================================================
-- RIDE BOOKING APP - SUPABASE SCHEMA
-- =====================================================================
-- Run this in Supabase SQL editor. Uses auth.users as the identity root.
-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- =====================================================================
-- ENUMS
-- =====================================================================
create type user_role          as enum ('PASSENGER', 'DRIVER', 'ADMIN');
create type driving_status     as enum ('STATIONARY', 'EN_ROUTE');
create type demand_level       as enum ('LOW', 'MEDIUM', 'HIGH');
create type booking_status     as enum ('PENDING', 'CONFIRMED', 'COMPLETED', 'DECLINED', 'CANCELLED');
create type overflow_status    as enum ('OPEN', 'ACCEPTED', 'DECLINED', 'EXPIRED');
create type seat_event_type    as enum ('BOARDING', 'ALIGHTING', 'SYSTEM_ADJUSTMENT', 'VERIFICATION');
create type seat_event_source  as enum ('SYSTEM', 'DRIVER');
create type tx_type            as enum ('TRIP_EARNING', 'WITHDRAWAL', 'BONUS', 'REFUND', 'TOP_UP');
create type tx_status          as enum ('COMPLETED', 'PENDING', 'FAILED');
create type withdrawal_method  as enum ('MOBILE_MONEY', 'BANK_TRANSFER');

-- =====================================================================
-- PROFILES (one row per auth.users)
-- =====================================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         text unique not null,
  email         text unique,
  full_name     text not null,
  role          user_role not null default 'PASSENGER',
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on profiles(role);

-- =====================================================================
-- ROUTES & STOPS
-- =====================================================================
create table routes (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  origin                  text not null,
  destination             text not null,
  distance_km             numeric(8,2) not null default 0,
  estimated_duration_min  int not null default 0,
  demand_level            demand_level not null default 'LOW',
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);

create table stops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  geog        geography(Point, 4326) generated always as
              (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) stored,
  created_at  timestamptz not null default now()
);
create index stops_geog_idx on stops using gist(geog);

create table route_stops (
  route_id    uuid references routes(id) on delete cascade,
  stop_id     uuid references stops(id)  on delete cascade,
  position    int not null,
  primary key (route_id, stop_id)
);
create index on route_stops(route_id, position);

-- =====================================================================
-- BUSES & DRIVERS
-- =====================================================================
create table buses (
  id             uuid primary key default gen_random_uuid(),
  registration   text unique not null,
  total_seats    int not null check (total_seats > 0),
  model          text,
  created_at     timestamptz not null default now()
);

create table drivers (
  id                  uuid primary key references profiles(id) on delete cascade,
  bus_id              uuid references buses(id) on delete set null,
  assigned_route_id   uuid references routes(id) on delete set null,
  is_available        boolean not null default false,
  driving_status      driving_status not null default 'STATIONARY',
  available_seats     int not null default 0,
  current_lat         double precision,
  current_lng         double precision,
  last_location_at    timestamptz,
  scheduling_start    time,
  scheduling_end      time,
  pro_subscribed      boolean not null default false,
  pro_expires_at      timestamptz,
  updated_at          timestamptz not null default now()
);
create index on drivers(is_available, driving_status);
create index on drivers(assigned_route_id);

-- =====================================================================
-- TRIPS (a driver's active journey along a route)
-- =====================================================================
create table trips (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid not null references drivers(id) on delete cascade,
  bus_id           uuid references buses(id),
  route_id         uuid not null references routes(id),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  starting_seats   int not null,
  created_at       timestamptz not null default now()
);
create index on trips(driver_id, ended_at);

-- =====================================================================
-- BOOKINGS
-- =====================================================================
create table bookings (
  id                      uuid primary key default gen_random_uuid(),
  passenger_id            uuid not null references profiles(id) on delete cascade,
  driver_id               uuid references drivers(id) on delete set null,
  trip_id                 uuid references trips(id) on delete set null,
  route_id                uuid references routes(id),
  pickup_stop_id          uuid references stops(id),
  destination_stop_id     uuid references stops(id),
  pickup_stop             text not null,
  destination_stop        text not null,
  seats_taken             int not null default 1 check (seats_taken > 0),
  desired_arrival_time    timestamptz,
  buffer_minutes          int not null default 0,
  status                  booking_status not null default 'PENDING',
  auto_accepted           boolean not null default false,
  auto_accepted_at        timestamptz,
  verification_code       text,
  verified_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index on bookings(driver_id, status);
create index on bookings(passenger_id, status);
create index on bookings(verification_code);

-- =====================================================================
-- SEAT EVENTS (audit trail of seat changes)
-- =====================================================================
create table seat_events (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid not null references drivers(id) on delete cascade,
  trip_id          uuid references trips(id) on delete set null,
  booking_id       uuid references bookings(id) on delete set null,
  type             seat_event_type not null,
  source           seat_event_source not null,
  seats_changed    int not null,
  seats_after      int not null,
  passenger_name   text,
  created_at       timestamptz not null default now()
);
create index on seat_events(driver_id, created_at desc);

-- =====================================================================
-- OVERFLOW / DEMAND
-- =====================================================================
create table overflow_requests (
  id                   uuid primary key default gen_random_uuid(),
  passenger_id         uuid references profiles(id) on delete set null,
  stop_id              uuid references stops(id),
  stop_name            text not null,
  pickup_stop          text not null,
  destination_stop     text,
  passenger_name       text,
  demand_count         int not null default 1,
  lat                  double precision not null,
  lng                  double precision not null,
  status               overflow_status not null default 'OPEN',
  accepted_by_driver   uuid references drivers(id) on delete set null,
  expires_at           timestamptz not null,
  created_at           timestamptz not null default now()
);
create index on overflow_requests(status, expires_at);

create table demand_stops_snapshot (
  id            uuid primary key default gen_random_uuid(),
  stop_id       uuid references stops(id) on delete cascade,
  demand_count  int not null default 0,
  captured_at   timestamptz not null default now()
);

-- =====================================================================
-- WALLET & PAYMENTS
-- =====================================================================
create table wallets (
  user_id     uuid primary key references profiles(id) on delete cascade,
  available   numeric(12,2) not null default 0,
  pending     numeric(12,2) not null default 0,
  currency    text not null default 'NGN',
  updated_at  timestamptz not null default now()
);

create table wallet_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  type         tx_type not null,
  status       tx_status not null default 'PENDING',
  amount       numeric(12,2) not null,
  currency     text not null default 'NGN',
  description  text,
  reference    text unique,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index on wallet_transactions(user_id, created_at desc);

create table withdrawals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  amount          numeric(12,2) not null,
  method          withdrawal_method not null,
  provider        text,
  account_number  text not null,
  account_name    text not null,
  status          tx_status not null default 'PENDING',
  transaction_id  uuid references wallet_transactions(id),
  created_at      timestamptz not null default now()
);

create table paystack_payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  reference          text unique not null,
  access_code        text,
  authorization_url  text,
  amount             numeric(12,2) not null,
  currency           text not null default 'NGN',
  channel            text,
  verified           boolean not null default false,
  verified_at        timestamptz,
  raw_response       jsonb,
  created_at         timestamptz not null default now()
);

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
create table notification_settings (
  user_id             uuid primary key references profiles(id) on delete cascade,
  push_enabled        boolean not null default true,
  bookings_enabled    boolean not null default true,
  promotions_enabled  boolean not null default false,
  demand_alerts       boolean not null default true,
  updated_at          timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on notifications(user_id, created_at desc);

-- =====================================================================
-- UPDATED_AT TRIGGER
-- =====================================================================
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

create trigger t_profiles_u  before update on profiles  for each row execute function set_updated_at();
create trigger t_drivers_u   before update on drivers   for each row execute function set_updated_at();
create trigger t_bookings_u  before update on bookings  for each row execute function set_updated_at();
create trigger t_wallets_u   before update on wallets   for each row execute function set_updated_at();
create trigger t_nsettings_u before update on notification_settings for each row execute function set_updated_at();

-- =====================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================================
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, phone, email, full_name, role)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'PASSENGER')
  );
  insert into wallets(user_id) values (new.id);
  insert into notification_settings(user_id) values (new.id);
  return new;
end $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table profiles              enable row level security;
alter table drivers               enable row level security;
alter table buses                 enable row level security;
alter table routes                enable row level security;
alter table stops                 enable row level security;
alter table route_stops           enable row level security;
alter table trips                 enable row level security;
alter table bookings              enable row level security;
alter table seat_events           enable row level security;
alter table overflow_requests     enable row level security;
alter table wallets               enable row level security;
alter table wallet_transactions   enable row level security;
alter table withdrawals           enable row level security;
alter table paystack_payments     enable row level security;
alter table notifications         enable row level security;
alter table notification_settings enable row level security;

-- Profiles: read any, update own
create policy "profiles_select_all"  on profiles for select using (true);
create policy "profiles_update_own"  on profiles for update using (auth.uid() = id);

-- Routes / stops / buses: public read
create policy "routes_read"      on routes      for select using (true);
create policy "stops_read"       on stops       for select using (true);
create policy "route_stops_read" on route_stops for select using (true);
create policy "buses_read"       on buses       for select using (true);

-- Drivers: read all (passengers need to see), update own
create policy "drivers_read"       on drivers for select using (true);
create policy "drivers_update_own" on drivers for update using (auth.uid() = id);

-- Bookings: passenger or driver involved
create policy "bookings_select_own" on bookings for select
  using (auth.uid() = passenger_id or auth.uid() = driver_id);
create policy "bookings_insert_own" on bookings for insert
  with check (auth.uid() = passenger_id);
create policy "bookings_update_involved" on bookings for update
  using (auth.uid() = passenger_id or auth.uid() = driver_id);

-- Seat events: visible to that driver
create policy "seat_events_driver" on seat_events for select
  using (auth.uid() = driver_id);
create policy "seat_events_insert" on seat_events for insert
  with check (auth.uid() = driver_id);

-- Trips: driver owns
create policy "trips_driver_rw" on trips for all
  using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

-- Overflow: passengers create, drivers read open
create policy "overflow_read" on overflow_requests for select using (true);
create policy "overflow_insert" on overflow_requests for insert
  with check (auth.uid() = passenger_id);
create policy "overflow_update_driver" on overflow_requests for update
  using (auth.uid() = accepted_by_driver or auth.uid() = passenger_id);

-- Wallet & tx: strictly owner
create policy "wallets_owner"             on wallets              for select using (auth.uid() = user_id);
create policy "wallet_tx_owner"           on wallet_transactions  for select using (auth.uid() = user_id);
create policy "withdrawals_owner_select"  on withdrawals          for select using (auth.uid() = user_id);
create policy "withdrawals_owner_insert"  on withdrawals          for insert with check (auth.uid() = user_id);
create policy "paystack_owner_select"     on paystack_payments    for select using (auth.uid() = user_id);

-- Notifications: owner only
create policy "notif_owner"    on notifications         for select using (auth.uid() = user_id);
create policy "notif_update"   on notifications         for update using (auth.uid() = user_id);
create policy "nsettings_owner" on notification_settings for all   using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- STORAGE BUCKET FOR AVATARS (run once)
-- =====================================================================
-- insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
--   on conflict (id) do nothing;
-- create policy "avatar_public_read"  on storage.objects for select using (bucket_id = 'avatars');
-- create policy "avatar_user_write"   on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "avatar_user_update"  on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
