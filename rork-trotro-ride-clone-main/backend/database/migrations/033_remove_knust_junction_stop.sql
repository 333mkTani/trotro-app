-- KNUST Junction was an invalid operational stop. Preserve the row because an
-- existing booking may reference it, but remove it from discovery and routing.
DELETE FROM public.route_stops
WHERE stop_id = 'c2000000-0000-0000-0000-000000000004';

UPDATE public.bus_stops
SET status = 'deleted'
WHERE id = 'c2000000-0000-0000-0000-000000000004'
   OR lower(name) = 'knust junction';
