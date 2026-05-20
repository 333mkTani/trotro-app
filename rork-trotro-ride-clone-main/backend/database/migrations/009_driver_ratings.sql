-- Driver ratings (1 per booking)
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
