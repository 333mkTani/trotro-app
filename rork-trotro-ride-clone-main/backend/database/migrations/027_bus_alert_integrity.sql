-- Harden alert configuration independently of API validation.
update public.bus_alerts
   set is_active = false
 where is_active = true and alert_time is null and schedule is null;

alter table public.bus_alerts
  add constraint bus_alerts_active_configuration_check
    check (not is_active or alert_time is not null or schedule is not null);
alter table public.bus_alerts
  add constraint bus_alerts_schedule_object_check
    check (schedule is null or jsonb_typeof(schedule) = 'object');
alter table public.bus_alerts
  add constraint bus_alerts_timezone_check
    check (length(trim(timezone)) between 1 and 80);

create index if not exists bus_alerts_due_one_time_idx
  on public.bus_alerts(alert_time)
  where is_active = true and schedule is null and triggered = false;

create index if not exists bus_alerts_due_recurring_idx
  on public.bus_alerts(is_active, last_triggered_day)
  where schedule is not null;

create or replace function public.bus_alert_validate_route_stop()
returns trigger language plpgsql as $$
begin
  if new.route_id is not null and not exists (
    select 1 from public.route_stops
     where route_id = new.route_id and stop_id = new.stop_id
  ) then
    raise exception 'bus alert stop does not belong to route' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_bus_alert_validate_route_stop on public.bus_alerts;
create trigger trg_bus_alert_validate_route_stop
  before insert or update of route_id, stop_id on public.bus_alerts
  for each row execute function public.bus_alert_validate_route_stop();
