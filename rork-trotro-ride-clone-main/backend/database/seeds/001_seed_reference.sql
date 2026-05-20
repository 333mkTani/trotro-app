-- Reference data seed: a few stops + one route. Idempotent via ON CONFLICT.
insert into public.bus_stops (id, name, type, lat, lng) values
  ('11111111-1111-1111-1111-111111111111', 'Accra Central',     'station', 5.5502, -0.2174),
  ('22222222-2222-2222-2222-222222222222', 'Kwame Nkrumah Cir', 'station', 5.5710, -0.2070),
  ('33333333-3333-3333-3333-333333333333', '37 Station',        'station', 5.5860, -0.1850),
  ('44444444-4444-4444-4444-444444444444', 'Madina Market',     'station', 5.6830, -0.1660)
on conflict (id) do nothing;

insert into public.routes (id, name, origin, destination, distance_km, duration_min, fare) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Circle → Madina', 'Kwame Nkrumah Circle', 'Madina', 14.50, 45, 6.00)
on conflict (id) do nothing;

insert into public.route_stops (route_id, stop_id, sequence) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 3)
on conflict do nothing;
