-- Correct the Tech Junction seed point. The old coordinate placed the stop
-- roughly 1.5 km south-east of the junction and distorted route suggestions.
UPDATE public.bus_stops
SET lat = 6.687140,
    lng = -1.575240
WHERE id = 'c2000000-0000-0000-0000-000000000003'
   OR lower(name) = 'tech junction';

-- Keep PostGIS location data correct even in environments without the normal
-- bus-stop geometry maintenance trigger.
UPDATE public.bus_stops
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE id = 'c2000000-0000-0000-0000-000000000003'
   OR lower(name) = 'tech junction';
