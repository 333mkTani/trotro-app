-- Repair historical over-capacity values before enforcing the invariant.
update public.buses
   set seats_available = least(greatest(seats_available, 0), total_seats)
 where seats_available < 0 or seats_available > total_seats;

alter table public.buses drop constraint if exists buses_seat_capacity_check;
alter table public.buses
  add constraint buses_seat_capacity_check
  check (total_seats > 0 and seats_available between 0 and total_seats);

