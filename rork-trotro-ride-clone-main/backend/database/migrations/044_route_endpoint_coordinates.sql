-- Persist route endpoint coordinates. Existing routes inherit their first and
-- last ordered stop where available; routes without stops remain nullable.
alter table public.routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision;

update public.routes r
   set origin_lat = coalesce(r.origin_lat, (
         select s.lat from public.route_stops rs join public.bus_stops s on s.id = rs.stop_id
          where rs.route_id = r.id order by rs.sequence asc limit 1)),
       origin_lng = coalesce(r.origin_lng, (
         select s.lng from public.route_stops rs join public.bus_stops s on s.id = rs.stop_id
          where rs.route_id = r.id order by rs.sequence asc limit 1)),
       destination_lat = coalesce(r.destination_lat, (
         select s.lat from public.route_stops rs join public.bus_stops s on s.id = rs.stop_id
          where rs.route_id = r.id order by rs.sequence desc limit 1)),
       destination_lng = coalesce(r.destination_lng, (
         select s.lng from public.route_stops rs join public.bus_stops s on s.id = rs.stop_id
          where rs.route_id = r.id order by rs.sequence desc limit 1));

alter table public.routes
  drop constraint if exists routes_origin_lat_check,
  drop constraint if exists routes_origin_lng_check,
  drop constraint if exists routes_destination_lat_check,
  drop constraint if exists routes_destination_lng_check,
  add constraint routes_origin_lat_check check (origin_lat is null or origin_lat between -90 and 90),
  add constraint routes_origin_lng_check check (origin_lng is null or origin_lng between -180 and 180),
  add constraint routes_destination_lat_check check (destination_lat is null or destination_lat between -90 and 90),
  add constraint routes_destination_lng_check check (destination_lng is null or destination_lng between -180 and 180);
