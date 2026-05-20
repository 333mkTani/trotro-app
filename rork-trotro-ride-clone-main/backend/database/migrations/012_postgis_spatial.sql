-- =========================================================================
-- PostGIS spatial layer.
-- Adds a geography(Point, 4326) column to bus_stops and buses, kept in sync
-- with their lat/lng via triggers, plus GIST indices for fast radius and
-- nearest-neighbour queries (ST_DWithin, KNN <->).
-- Idempotent: safe to re-run.
-- =========================================================================

create extension if not exists "postgis";

-- ---- bus_stops ----------------------------------------------------------
alter table public.bus_stops
  add column if not exists geom geography(Point, 4326);

update public.bus_stops
   set geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
 where geom is null and lat is not null and lng is not null;

create or replace function public.bus_stops_sync_geom()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geom = ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end $$;

drop trigger if exists trg_bus_stops_geom on public.bus_stops;
create trigger trg_bus_stops_geom
  before insert or update of lat, lng on public.bus_stops
  for each row execute function public.bus_stops_sync_geom();

create index if not exists bus_stops_geom_idx
  on public.bus_stops using gist (geom);

-- ---- buses --------------------------------------------------------------
alter table public.buses
  add column if not exists geom geography(Point, 4326);

update public.buses
   set geom = ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography
 where geom is null and current_lat is not null and current_lng is not null;

create or replace function public.buses_sync_geom()
returns trigger language plpgsql as $$
begin
  if new.current_lat is not null and new.current_lng is not null then
    new.geom = ST_SetSRID(ST_MakePoint(new.current_lng, new.current_lat), 4326)::geography;
  else
    new.geom = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_buses_geom on public.buses;
create trigger trg_buses_geom
  before insert or update of current_lat, current_lng on public.buses
  for each row execute function public.buses_sync_geom();

create index if not exists buses_geom_idx
  on public.buses using gist (geom);
