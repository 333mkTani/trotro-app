-- Payment-backed seat reservations and an auditable transaction ledger.
-- This migration adds financial state only; payment collection is introduced separately.

do $$ begin
  create type reservation_payment_status as enum (
    'unpaid',
    'deposit_pending',
    'deposit_paid',
    'balance_pending',
    'fully_paid',
    'refund_pending',
    'partially_refunded',
    'refunded',
    'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_payment_type as enum (
    'deposit',
    'balance',
    'refund',
    'no_show_compensation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_payment_status as enum (
    'initiated',
    'pending',
    'succeeded',
    'failed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

alter table public.bookings
  add column if not exists payment_status reservation_payment_status not null default 'unpaid',
  add column if not exists total_fare numeric(10,2),
  add column if not exists deposit_amount numeric(10,2) not null default 0,
  add column if not exists remaining_balance numeric(10,2),
  add column if not exists boarding_deadline timestamptz,
  add column if not exists cancellation_deadline timestamptz,
  add column if not exists no_show_marked_at timestamptz;

-- Preserve the existing fare value while services migrate to total_fare.
update public.bookings
set total_fare = ride_fare
where total_fare is null and ride_fare is not null;

alter table public.bookings drop constraint if exists bookings_payment_amounts_check;
alter table public.bookings
  add constraint bookings_payment_amounts_check check (
    (total_fare is null or total_fare >= 0)
    and deposit_amount >= 0
    and (remaining_balance is null or remaining_balance >= 0)
    and (total_fare is null or deposit_amount <= total_fare)
    and (total_fare is null or remaining_balance is null or remaining_balance <= total_fare)
  );

alter table public.bookings drop constraint if exists bookings_payment_deadlines_check;
alter table public.bookings
  add constraint bookings_payment_deadlines_check check (
    boarding_deadline is null
    or cancellation_deadline is null
    or cancellation_deadline <= boarding_deadline
  );

alter table public.schedule_occurrences
  add column if not exists payment_status reservation_payment_status not null default 'unpaid',
  add column if not exists total_fare numeric(10,2),
  add column if not exists deposit_amount numeric(10,2) not null default 0,
  add column if not exists remaining_balance numeric(10,2),
  add column if not exists cancellation_deadline timestamptz,
  add column if not exists no_show_marked_at timestamptz;

alter table public.schedule_occurrences drop constraint if exists schedule_occurrences_payment_amounts_check;
alter table public.schedule_occurrences
  add constraint schedule_occurrences_payment_amounts_check check (
    (total_fare is null or total_fare >= 0)
    and deposit_amount >= 0
    and (remaining_balance is null or remaining_balance >= 0)
    and (total_fare is null or deposit_amount <= total_fare)
    and (total_fare is null or remaining_balance is null or remaining_balance <= total_fare)
  );

alter table public.schedule_occurrences drop constraint if exists schedule_occurrences_cancellation_deadline_check;
alter table public.schedule_occurrences
  add constraint schedule_occurrences_cancellation_deadline_check check (
    cancellation_deadline is null or cancellation_deadline <= boarding_end_at
  );

create table if not exists public.booking_payments (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid references public.bookings(id) on delete restrict,
  occurrence_id         uuid references public.schedule_occurrences(id) on delete restrict,
  passenger_id          uuid not null references public.profiles(id) on delete restrict,
  driver_id             uuid references public.drivers(id) on delete restrict,
  type                  booking_payment_type not null,
  amount                numeric(10,2) not null check (amount > 0),
  currency              char(3) not null default 'GHS',
  status                booking_payment_status not null default 'initiated',
  provider              text,
  provider_reference    text,
  idempotency_key       text not null unique,
  failure_code          text,
  failure_message       text,
  metadata              jsonb not null default '{}'::jsonb,
  initiated_at          timestamptz not null default now(),
  confirmed_at          timestamptz,
  failed_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check ((booking_id is not null)::integer + (occurrence_id is not null)::integer = 1),
  check (currency = upper(currency)),
  check (confirmed_at is null or status = 'succeeded'),
  check (failed_at is null or status = 'failed')
);

create unique index if not exists booking_payments_provider_reference_uidx
  on public.booking_payments(provider, provider_reference)
  where provider is not null and provider_reference is not null;

create index if not exists booking_payments_booking_idx
  on public.booking_payments(booking_id, created_at desc)
  where booking_id is not null;

create index if not exists booking_payments_occurrence_idx
  on public.booking_payments(occurrence_id, created_at desc)
  where occurrence_id is not null;

create index if not exists booking_payments_passenger_idx
  on public.booking_payments(passenger_id, created_at desc);

create index if not exists booking_payments_pending_idx
  on public.booking_payments(status, initiated_at)
  where status in ('initiated', 'pending');

create index if not exists bookings_payment_status_idx
  on public.bookings(payment_status, created_at desc);

create index if not exists schedule_occurrences_payment_status_idx
  on public.schedule_occurrences(payment_status, service_date desc);
