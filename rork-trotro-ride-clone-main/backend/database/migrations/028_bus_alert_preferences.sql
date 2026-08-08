alter table public.profiles
  add column if not exists bus_alerts_enabled boolean not null default true;
