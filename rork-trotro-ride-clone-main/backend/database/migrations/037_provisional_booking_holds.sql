-- Short-lived seat holds created while a passenger completes the deposit.
alter table public.bookings
  add column if not exists hold_expires_at timestamptz;

alter table public.bookings drop constraint if exists bookings_provisional_hold_check;
alter table public.bookings
  add constraint bookings_provisional_hold_check check (
    payment_status <> 'deposit_pending'
    or (bus_id is not null and driver_id is not null and hold_expires_at is not null)
  );

create index if not exists bookings_active_provisional_holds_idx
  on public.bookings(bus_id, hold_expires_at)
  where status = 'pending' and payment_status = 'deposit_pending';
