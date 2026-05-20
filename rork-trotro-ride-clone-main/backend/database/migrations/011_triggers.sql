-- updated_at trigger helpers and auto profile/wallet provisioning
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_users_updated     on public.users;
drop trigger if exists trg_profiles_updated  on public.profiles;
drop trigger if exists trg_bookings_updated  on public.bookings;
drop trigger if exists trg_wallets_updated   on public.wallets;

create trigger trg_users_updated     before update on public.users     for each row execute function public.set_updated_at();
create trigger trg_profiles_updated  before update on public.profiles  for each row execute function public.set_updated_at();
create trigger trg_bookings_updated  before update on public.bookings  for each row execute function public.set_updated_at();
create trigger trg_wallets_updated   before update on public.wallets   for each row execute function public.set_updated_at();

-- Auto-create a wallet row whenever a profile is created
create or replace function public.handle_new_profile()
returns trigger language plpgsql as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_profile_created on public.profiles;
create trigger trg_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();
