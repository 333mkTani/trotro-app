-- A driver may own only one non-deleted bus at a time. This makes profile
-- updates deterministic and prevents a second active row remaining visible.
CREATE UNIQUE INDEX IF NOT EXISTS buses_one_live_driver_idx
  ON public.buses(driver_id)
  WHERE driver_id IS NOT NULL AND status <> 'deleted';
