-- =============================================================================
-- Seed: Kumasi trotro routes, stops, and buses
-- Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
-- Requires migration 015 (city column).
-- Stop UUIDs:  c2xxxxxx-...  (c2 = Kumasi stops)
-- Route UUIDs: d2xxxxxx-...  (d2 = Kumasi routes)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Ensure city column exists (idempotent — safe if 015 already ran)
-- -----------------------------------------------------------------------------
ALTER TABLE public.bus_stops ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'accra';
ALTER TABLE public.routes    ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'accra';

CREATE INDEX IF NOT EXISTS bus_stops_city_idx ON public.bus_stops(city);
CREATE INDEX IF NOT EXISTS routes_city_idx    ON public.routes(city);

-- -----------------------------------------------------------------------------
-- 1. Bus Stops (Kumasi)
-- -----------------------------------------------------------------------------
INSERT INTO public.bus_stops (id, name, type, lat, lng, city, status) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'Adum',                    'station', 6.688500,  -1.624400, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000002', 'Kejetia',                 'station', 6.695300,  -1.623200, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000003', 'Tech Junction',           'stop',    6.674200,  -1.571200, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000004', 'KNUST Junction',          'stop',    6.673600,  -1.565500, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000005', 'Conti Roundabout',        'stop',    6.679246,  -1.570650, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000006', 'Paa Joe Bus Stop',        'stop',    6.678555,  -1.570318, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000007', 'Agric Junction',          'stop',    6.677262,  -1.567121, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000008', 'Stairs',                  'stop',    6.676409,  -1.565394, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000009', 'Ayeduase Gate',           'stop',    6.675656,  -1.563851, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000010', 'Atta Mills Junction',     'stop',    6.675785,  -1.562488, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000011', 'Barima Nkwan Junction',   'stop',    6.675909,  -1.561336, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000012', 'Ayeduase Station',        'station', 6.675881,  -1.558881, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000013', 'Kotei Benab',             'stop',    6.673019,  -1.558518, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000014', 'Manchester',              'stop',    6.669701,  -1.558459, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000015', 'Kotei Junction',          'stop',    6.664450,  -1.558926, 'kumasi', 'active'),
  ('c2000000-0000-0000-0000-000000000016', 'Deduako Station',         'station', 6.658875,  -1.546011, 'kumasi', 'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Routes (Kumasi)
-- One record per physical corridor. The backend exposes both stops_sequence
-- (forward) and reverse_stops_sequence (reverse) so passengers can travel
-- in either direction without duplicate route entries.
-- -----------------------------------------------------------------------------
INSERT INTO public.routes (id, name, origin, destination, distance_km, duration_min, fare, city, status) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'Adum - Deduako', 'Adum', 'Deduako Station', 14.50, 45, 4.00, 'kumasi', 'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Route → Stop sequences  (Adum - Deduako, 16 stops)
-- -----------------------------------------------------------------------------
INSERT INTO public.route_stops (route_id, stop_id, sequence) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',  1),  -- Adum
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002',  2),  -- Kejetia
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003',  3),  -- Tech Junction
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004',  4),  -- KNUST Junction
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005',  5),  -- Conti Roundabout
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006',  6),  -- Paa Joe Bus Stop
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007',  7),  -- Agric Junction
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008',  8),  -- Stairs
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000009',  9),  -- Ayeduase Gate
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000010', 10),  -- Atta Mills Junction
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 11),  -- Barima Nkwan Junction
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000012', 12),  -- Ayeduase Station
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 13),  -- Kotei Benab
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000014', 14),  -- Manchester
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000015', 15),  -- Kotei Junction
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 16)   -- Deduako Station
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Buses (Kumasi) — 2 per route
-- -----------------------------------------------------------------------------
INSERT INTO public.buses (id, registration, route_id, total_seats, seats_available, status) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'AS-1001-24', 'd2000000-0000-0000-0000-000000000001', 14, 14, 'active'),
  ('e2000000-0000-0000-0000-000000000002', 'GR-1002-23', 'd2000000-0000-0000-0000-000000000001', 14, 14, 'active')
ON CONFLICT (id) DO NOTHING;
