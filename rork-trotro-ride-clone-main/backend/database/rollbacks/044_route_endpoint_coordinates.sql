alter table public.routes
  drop constraint if exists routes_origin_lat_check,
  drop constraint if exists routes_origin_lng_check,
  drop constraint if exists routes_destination_lat_check,
  drop constraint if exists routes_destination_lng_check,
  drop column if exists origin_lat,
  drop column if exists origin_lng,
  drop column if exists destination_lat,
  drop column if exists destination_lng;
