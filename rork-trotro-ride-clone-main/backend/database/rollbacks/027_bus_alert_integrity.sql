drop trigger if exists trg_bus_alert_validate_route_stop on public.bus_alerts;
drop function if exists public.bus_alert_validate_route_stop();
drop index if exists public.bus_alerts_due_recurring_idx;
drop index if exists public.bus_alerts_due_one_time_idx;
alter table public.bus_alerts drop constraint if exists bus_alerts_timezone_check;
alter table public.bus_alerts drop constraint if exists bus_alerts_schedule_object_check;
alter table public.bus_alerts drop constraint if exists bus_alerts_active_configuration_check;
