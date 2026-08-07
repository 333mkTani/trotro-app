-- Persist driver mode so booking acceptance is enforced by the API.
ALTER TABLE public.buses
  ADD COLUMN IF NOT EXISTS driving_status text NOT NULL DEFAULT 'STATIONARY';
ALTER TABLE public.buses
  DROP CONSTRAINT IF EXISTS buses_driving_status_check;
ALTER TABLE public.buses
  ADD CONSTRAINT buses_driving_status_check
  CHECK (driving_status IN ('STATIONARY', 'EN_ROUTE'));

-- Safe rollout: existing buses must explicitly opt into auto-acceptance.
UPDATE public.buses SET driving_status = 'STATIONARY';

CREATE INDEX IF NOT EXISTS buses_operating_state_idx
  ON public.buses(status, driving_status, route_id)
  WHERE seats_available > 0;
