alter table public.booking_payments
  add column if not exists parent_payment_id uuid references public.booking_payments(id) on delete restrict,
  add column if not exists provider_event_id text;

create unique index if not exists booking_payments_one_active_refund_uidx
  on public.booking_payments(parent_payment_id)
  where type = 'refund' and status in ('initiated', 'pending', 'succeeded');

create table if not exists public.payment_reconciliation_events (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null,
  event_key          text not null,
  event_type         text not null,
  booking_id         uuid references public.bookings(id) on delete set null,
  payment_id         uuid references public.booking_payments(id) on delete set null,
  provider_reference text,
  payload            jsonb not null default '{}'::jsonb,
  outcome            text not null check (outcome in ('processed','ignored','failed')),
  error_message      text,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz not null default now(),
  unique (provider, event_key)
);

create index if not exists payment_reconciliation_booking_idx
  on public.payment_reconciliation_events(booking_id, received_at desc);
