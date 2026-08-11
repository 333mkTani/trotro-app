-- Persist provider checkout details so deposit initialization is safely retryable.
alter table public.booking_payments
  add column if not exists authorization_url text,
  add column if not exists access_code text,
  add column if not exists provider_channel text;

-- A booking may retry after a failed attempt, but it must not have multiple
-- simultaneous or successful deposit transactions.
create unique index if not exists booking_payments_one_active_deposit_uidx
  on public.booking_payments(booking_id)
  where type = 'deposit' and status in ('initiated', 'pending', 'succeeded');
