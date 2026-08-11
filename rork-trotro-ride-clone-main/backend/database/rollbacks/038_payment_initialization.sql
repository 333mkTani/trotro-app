drop index if exists public.booking_payments_one_active_deposit_uidx;

alter table public.booking_payments
  drop column if exists provider_channel,
  drop column if exists access_code,
  drop column if exists authorization_url;
