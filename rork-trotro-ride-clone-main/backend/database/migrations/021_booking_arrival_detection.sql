-- Server-side destination arrival detection. Arrival is informational only;
-- payment/completion remains an explicit passenger action.
alter table public.bookings
  add column if not exists arrival_near_at timestamptz,
  add column if not exists arrived_at timestamptz,
  add column if not exists expired_at timestamptz;

create index if not exists bookings_arrival_pending_idx
  on public.bookings(driver_id)
  where status = 'confirmed' and arrived_at is null;

