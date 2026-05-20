-- Boarding pass / verification codes (numeric + QR payload)
create table if not exists public.verification_codes (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null unique references public.bookings(id) on delete cascade,
  code               text not null unique,
  qr_payload         text,
  status             code_status not null default 'valid',
  valid_until        timestamptz not null,
  used_at            timestamptz,
  invalidated_at     timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists verification_codes_status_idx on public.verification_codes(status);
