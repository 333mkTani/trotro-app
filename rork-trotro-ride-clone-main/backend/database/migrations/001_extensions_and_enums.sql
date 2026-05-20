-- Extensions and shared ENUM types
create extension if not exists "pgcrypto";

do $$ begin
  create type user_role            as enum ('passenger', 'admin', 'driver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status       as enum ('pending', 'confirmed', 'completed', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bus_stop_type        as enum ('stop', 'station');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entity_status        as enum ('active', 'paused', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type code_status          as enum ('valid', 'used', 'expired', 'invalidated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type     as enum ('top_up', 'ride_payment', 'driver_payment', 'refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_status   as enum ('completed', 'pending', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ride_payment_method  as enum ('wallet', 'cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method       as enum ('momo_mtn', 'momo_vodafone', 'momo_airteltigo', 'card', 'bank');
exception when duplicate_object then null; end $$;

do $$ begin
  create type schedule_time_mode   as enum ('same', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_mode           as enum ('system', 'light', 'dark');
exception when duplicate_object then null; end $$;
