-- Kept separate from migration 041 because PostgreSQL enum values must be
-- committed before they can be referenced by indexes or application writes.
alter table public.bookings
  add column if not exists driver_pickup_arrived_at timestamptz,
  add column if not exists no_show_compensation_amount numeric(10,2),
  add column if not exists no_show_compensated_at timestamptz;

alter table public.bookings drop constraint if exists bookings_no_show_compensation_check;
alter table public.bookings add constraint bookings_no_show_compensation_check check (
  (no_show_compensation_amount is null or no_show_compensation_amount > 0)
  and (no_show_compensated_at is null or no_show_compensation_amount is not null)
);

create unique index if not exists booking_payments_one_no_show_compensation_uidx
  on public.booking_payments(booking_id)
  where type = 'no_show_compensation' and status = 'succeeded';

create unique index if not exists wallet_transactions_one_no_show_compensation_uidx
  on public.wallet_transactions(booking_id, user_id)
  where type = 'no_show_compensation' and status = 'completed';
