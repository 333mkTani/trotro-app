-- A verified deposit may credit the assigned driver only once.
create unique index if not exists wallet_transactions_one_driver_deposit_settlement_uidx
  on public.wallet_transactions (booking_id, user_id)
  where type = 'driver_payment' and status = 'completed';
