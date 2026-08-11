create unique index if not exists booking_payments_one_active_balance_uidx
  on public.booking_payments(booking_id)
  where type = 'balance' and status in ('initiated', 'pending', 'succeeded');
