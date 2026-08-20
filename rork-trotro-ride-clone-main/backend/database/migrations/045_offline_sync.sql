-- Offline-first synchronization foundation.
-- Server state remains authoritative; this migration stores mutation receipts
-- and an ordered change feed for authenticated clients.

create table if not exists public.sync_mutations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  device_id          text not null check (char_length(device_id) between 1 and 160),
  event_id           text not null check (char_length(event_id) between 1 and 160),
  idempotency_key    text not null check (char_length(idempotency_key) between 8 and 160),
  entity             text not null check (char_length(entity) between 1 and 80),
  operation          text not null check (char_length(operation) between 1 and 80),
  payload            jsonb not null default '{}'::jsonb,
  client_created_at timestamptz not null,
  status             text not null check (status in ('processing', 'accepted', 'duplicate', 'rejected', 'conflict', 'retryable')),
  result             jsonb not null default '{}'::jsonb,
  error_code         text,
  error_message      text,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz not null default now(),
  unique (user_id, event_id),
  unique (user_id, idempotency_key)
);

create index if not exists sync_mutations_user_created_idx
  on public.sync_mutations(user_id, created_at desc);

create table if not exists public.sync_changes (
  sequence_id       bigint generated always as identity primary key,
  audience_user_id  uuid references public.profiles(id) on delete cascade,
  entity            text not null check (char_length(entity) between 1 and 80),
  entity_id         text not null check (char_length(entity_id) between 1 and 160),
  operation         text not null check (operation in ('upsert', 'delete')),
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists sync_changes_private_cursor_idx
  on public.sync_changes(audience_user_id, sequence_id);

create index if not exists sync_changes_public_cursor_idx
  on public.sync_changes(sequence_id)
  where audience_user_id is null;

comment on table public.sync_mutations is
  'Idempotent client mutation receipts. Never delete financial or booking history; this table only records sync processing.';
comment on table public.sync_changes is
  'Append-only ordered change feed. A null audience_user_id denotes a public/cacheable change; a value scopes the change to one user.';
