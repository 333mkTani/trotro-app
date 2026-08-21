-- A booking releases its reserved seat at most once. The timestamp is the
-- audit proof that the inventory adjustment has been completed.
alter table public.bookings
  add column if not exists seat_released_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_seat_released_terminal_check;

alter table public.bookings
  add constraint bookings_seat_released_terminal_check
  check (seat_released_at is null or status in ('cancelled', 'expired', 'completed'));

create index if not exists bookings_seat_release_audit_idx
  on public.bookings (seat_released_at)
  where seat_released_at is not null;
