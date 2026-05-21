-- Custom auth credentials table (decoupled from Supabase auth.users).
-- Stores bcrypt password hashes keyed by the profile UUID.
create table if not exists public.auth_credentials (
  user_id       uuid primary key references public.users(id) on delete cascade,
  password_hash text not null,
  created_at    timestamptz not null default now()
);
