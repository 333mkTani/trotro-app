-- =============================================================================
-- Migration 015: Add city column to bus_stops and routes
-- Allows multiple cities (Accra, Kumasi, etc.) to coexist in the same tables.
-- Safe to re-run.
-- =============================================================================

-- Add column (defaults to 'accra' so existing rows are automatically tagged)
alter table public.bus_stops
  add column if not exists city text not null default 'accra';

alter table public.routes
  add column if not exists city text not null default 'accra';

-- Index for fast city-filtered queries
create index if not exists bus_stops_city_idx on public.bus_stops(city);
create index if not exists routes_city_idx    on public.routes(city);
