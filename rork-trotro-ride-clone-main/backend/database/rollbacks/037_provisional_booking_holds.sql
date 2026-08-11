drop index if exists public.bookings_active_provisional_holds_idx;

alter table public.bookings
  drop constraint if exists bookings_provisional_hold_check,
  drop column if exists hold_expires_at;
