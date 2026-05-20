-- Users (auth) and Profiles (1:1)
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  phone           text unique not null,
  email           text unique,
  password_hash   text not null,
  is_verified     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists users_phone_idx on public.users(phone);

create table if not exists public.profiles (
  id              uuid primary key references public.users(id) on delete cascade,
  phone           text unique not null,
  full_name       text not null,
  email           text,
  avatar_url      text,
  role            user_role not null default 'passenger',
  fcm_token       text,
  theme_mode      theme_mode not null default 'system',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);
