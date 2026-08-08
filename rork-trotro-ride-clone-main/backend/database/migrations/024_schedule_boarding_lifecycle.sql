-- Scheduled occurrence boarding codes and conversion into ordinary rides.
alter table public.bookings
  add column if not exists source_occurrence_id uuid unique
    references public.schedule_occurrences(id) on delete set null;

create table if not exists public.schedule_boarding_codes (
  id             uuid primary key default gen_random_uuid(),
  occurrence_id  uuid not null unique references public.schedule_occurrences(id) on delete cascade,
  booking_id     uuid unique references public.bookings(id) on delete set null,
  code           text not null unique,
  qr_payload     text not null,
  status         text not null default 'active'
                   check (status in ('active','used','expired','cancelled')),
  valid_from     timestamptz not null,
  valid_until    timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (valid_until > valid_from)
);

create index if not exists schedule_boarding_codes_lookup_idx
  on public.schedule_boarding_codes(code, status);

create table if not exists public.schedule_no_shows (
  id             uuid primary key default gen_random_uuid(),
  occurrence_id  uuid not null unique references public.schedule_occurrences(id) on delete cascade,
  passenger_id   uuid not null references public.profiles(id) on delete cascade,
  recorded_at    timestamptz not null default now()
);

create index if not exists schedule_no_shows_passenger_idx
  on public.schedule_no_shows(passenger_id, recorded_at desc);
