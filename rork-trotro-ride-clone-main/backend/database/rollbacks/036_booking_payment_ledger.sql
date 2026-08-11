drop table if exists public.booking_payments;

drop index if exists public.schedule_occurrences_payment_status_idx;
drop index if exists public.bookings_payment_status_idx;

alter table public.schedule_occurrences
  drop constraint if exists schedule_occurrences_cancellation_deadline_check,
  drop constraint if exists schedule_occurrences_payment_amounts_check,
  drop column if exists no_show_marked_at,
  drop column if exists cancellation_deadline,
  drop column if exists remaining_balance,
  drop column if exists deposit_amount,
  drop column if exists total_fare,
  drop column if exists payment_status;

alter table public.bookings
  drop constraint if exists bookings_payment_deadlines_check,
  drop constraint if exists bookings_payment_amounts_check,
  drop column if exists no_show_marked_at,
  drop column if exists cancellation_deadline,
  drop column if exists boarding_deadline,
  drop column if exists remaining_balance,
  drop column if exists deposit_amount,
  drop column if exists total_fare,
  drop column if exists payment_status;

drop type if exists booking_payment_status;
drop type if exists booking_payment_type;
drop type if exists reservation_payment_status;
