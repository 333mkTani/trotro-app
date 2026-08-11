-- Efficient, deterministic sweeps for abandoned payment holds and no-shows.
create index if not exists bookings_due_provisional_holds_idx
  on public.bookings(hold_expires_at)
  where status = 'pending' and payment_status = 'deposit_pending';

create index if not exists bookings_due_boarding_idx
  on public.bookings(boarding_deadline)
  where status = 'confirmed' and boarded_at is null;
