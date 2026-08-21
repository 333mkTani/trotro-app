-- Boarded rides must never be silently expired or have their seat released.
-- This metadata makes stalled boarded rides visible for recovery and reconciliation.
alter table public.bookings
  add column if not exists boarded_recovery_status text not null default 'none'
    check (boarded_recovery_status in ('none', 'pending', 'resolved', 'deferred')),
  add column if not exists boarded_recovery_at timestamptz,
  add column if not exists boarded_recovery_reason text;

create index if not exists bookings_boarded_recovery_idx
  on public.bookings (boarded_recovery_status, boarded_at)
  where boarded_at is not null and status = 'confirmed';
