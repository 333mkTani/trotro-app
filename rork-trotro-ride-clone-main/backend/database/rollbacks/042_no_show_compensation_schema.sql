drop index if exists public.wallet_transactions_one_no_show_compensation_uidx;
drop index if exists public.booking_payments_one_no_show_compensation_uidx;
alter table public.bookings drop constraint if exists bookings_no_show_compensation_check;
alter table public.bookings
  drop column if exists no_show_compensated_at,
  drop column if exists no_show_compensation_amount,
  drop column if exists driver_pickup_arrived_at;
