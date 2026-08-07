alter table public.bookings
  add column if not exists boarded_at timestamptz,
  add column if not exists paid_at timestamptz;

create index if not exists bookings_boarded_unpaid_idx
  on public.bookings(passenger_id)
  where status = 'confirmed' and boarded_at is not null and paid_at is null;

