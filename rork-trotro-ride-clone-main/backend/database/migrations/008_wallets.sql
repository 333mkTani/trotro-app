-- Wallets and signed transactions
create table if not exists public.wallets (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  balance        numeric(10,2) not null default 0,
  updated_at     timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  booking_id        uuid references public.bookings(id) on delete set null,
  type              transaction_type not null,
  amount            numeric(10,2) not null,
  description       text not null,
  status            transaction_status not null default 'completed',
  payment_method    payment_method,
  reference         text,
  created_at        timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx   on public.wallet_transactions(user_id, created_at desc);
create index if not exists wallet_tx_status_idx on public.wallet_transactions(status);
