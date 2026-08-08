-- Recurring commuter schedules and their independently managed daily trips.
-- Existing bookings remain untouched during the phased rollout.

do $$ begin
  create type commuter_schedule_status as enum ('active', 'paused', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type schedule_occurrence_status as enum (
    'pending', 'offered', 'accepted', 'boarding_open', 'boarded',
    'departed', 'completed', 'cancelled', 'expired', 'unmatched'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type schedule_response_status as enum ('accepted', 'declined', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type future_reservation_status as enum (
    'held', 'boarded', 'released', 'cancelled', 'expired'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.commuter_schedules (
  id                         uuid primary key default gen_random_uuid(),
  passenger_id               uuid not null references public.profiles(id) on delete cascade,
  route_id                   uuid not null references public.routes(id),
  departure_stop_id          uuid not null references public.bus_stops(id),
  destination_stop_id        uuid not null references public.bus_stops(id),
  travel_days                text[] not null,
  boarding_start_local       time not null,
  boarding_end_local         time not null,
  timezone                   text not null default 'Africa/Accra',
  primary_deadline_local     time not null default '20:00',
  backup_matching_enabled    boolean not null default false,
  status                     commuter_schedule_status not null default 'active',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (departure_stop_id <> destination_stop_id),
  check (cardinality(travel_days) between 1 and 7),
  check (travel_days <@ array['mon','tue','wed','thu','fri','sat','sun']::text[]),
  check (boarding_end_local > boarding_start_local)
);

create index if not exists commuter_schedules_passenger_idx
  on public.commuter_schedules(passenger_id, status, created_at desc);
create index if not exists commuter_schedules_route_idx
  on public.commuter_schedules(route_id, status);

create table if not exists public.schedule_occurrences (
  id                           uuid primary key default gen_random_uuid(),
  schedule_id                  uuid not null references public.commuter_schedules(id) on delete cascade,
  passenger_id                 uuid not null references public.profiles(id) on delete cascade,
  service_date                 date not null,
  boarding_start_at            timestamptz not null,
  boarding_end_at              timestamptz not null,
  primary_acceptance_deadline  timestamptz not null,
  final_acceptance_deadline    timestamptz not null,
  boarding_opens_at            timestamptz not null,
  status                       schedule_occurrence_status not null default 'pending',
  first_offered_at             timestamptz,
  reminder_queued_at           timestamptz,
  unmatched_notified_at        timestamptz,
  assigned_driver_id           uuid references public.drivers(id) on delete set null,
  assigned_bus_id              uuid references public.buses(id) on delete set null,
  accepted_at                  timestamptz,
  boarded_at                   timestamptz,
  departed_at                  timestamptz,
  completed_at                 timestamptz,
  cancelled_at                 timestamptz,
  expired_at                   timestamptz,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  unique (schedule_id, service_date),
  check (boarding_end_at > boarding_start_at),
  check (primary_acceptance_deadline <= final_acceptance_deadline),
  check (final_acceptance_deadline < boarding_end_at),
  check (boarding_opens_at <= boarding_start_at),
  check ((assigned_driver_id is null) = (assigned_bus_id is null)),
  check (status <> 'accepted' or (assigned_driver_id is not null and assigned_bus_id is not null))
);

create index if not exists schedule_occurrences_passenger_idx
  on public.schedule_occurrences(passenger_id, service_date desc);
create index if not exists schedule_occurrences_dispatch_idx
  on public.schedule_occurrences(status, primary_acceptance_deadline, final_acceptance_deadline);

create table if not exists public.driver_schedule_responses (
  id              uuid primary key default gen_random_uuid(),
  occurrence_id   uuid not null references public.schedule_occurrences(id) on delete cascade,
  driver_id       uuid not null references public.drivers(id) on delete cascade,
  bus_id          uuid not null references public.buses(id) on delete cascade,
  response        schedule_response_status not null,
  reason          text,
  responded_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (occurrence_id, driver_id)
);

create index if not exists driver_schedule_responses_driver_idx
  on public.driver_schedule_responses(driver_id, responded_at desc);

-- The occurrence row is locked during acceptance; this partial unique index
-- also makes the one-winning-driver invariant explicit at the database layer.
create unique index if not exists driver_schedule_responses_one_accept_idx
  on public.driver_schedule_responses(occurrence_id) where response = 'accepted';

create table if not exists public.future_reservations (
  id              uuid primary key default gen_random_uuid(),
  occurrence_id   uuid not null unique references public.schedule_occurrences(id) on delete cascade,
  passenger_id    uuid not null references public.profiles(id) on delete cascade,
  driver_id       uuid not null references public.drivers(id),
  bus_id          uuid not null references public.buses(id),
  seats           smallint not null default 1,
  status          future_reservation_status not null default 'held',
  held_at         timestamptz not null default now(),
  released_at     timestamptz,
  updated_at      timestamptz not null default now(),
  check (seats > 0)
);

create index if not exists future_reservations_capacity_idx
  on public.future_reservations(bus_id, status, held_at);

-- Transactional notification outbox. A unique recipient/event pair makes
-- worker retries and multiple API instances safe.
create table if not exists public.schedule_notification_jobs (
  id                uuid primary key default gen_random_uuid(),
  occurrence_id     uuid not null references public.schedule_occurrences(id) on delete cascade,
  recipient_id      uuid not null references public.profiles(id) on delete cascade,
  event_type        text not null check (event_type in (
    'schedule_offer', 'schedule_reminder', 'schedule_reopened',
    'schedule_accepted', 'schedule_driver_withdrawn', 'schedule_unmatched'
  )),
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'pending' check (status in ('pending','processing','sent','cancelled')),
  attempts          smallint not null default 0,
  next_attempt_at   timestamptz not null default now(),
  last_error        text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,
  unique (occurrence_id, recipient_id, event_type)
);

create index if not exists schedule_notification_jobs_pending_idx
  on public.schedule_notification_jobs(status, next_attempt_at, created_at);
