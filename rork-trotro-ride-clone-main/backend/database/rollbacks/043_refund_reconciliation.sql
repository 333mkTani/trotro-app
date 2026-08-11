drop table if exists public.payment_reconciliation_events;
drop index if exists public.booking_payments_one_active_refund_uidx;
alter table public.booking_payments
  drop column if exists provider_event_id,
  drop column if exists parent_payment_id;
