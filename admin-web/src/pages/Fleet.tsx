import { useQuery } from '@tanstack/react-query';
import { fetchFleet } from '../lib/queries';
import { count, dateTime, money, relative } from '../lib/format';
import { Badge, Card, Empty, ErrorState, Loading, Stat } from '../components/ui';

export function FleetPage() {
  const query = useQuery({
    queryKey: ['fleet'],
    queryFn: fetchFleet,
    refetchInterval: 15_000,
  });

  if (query.isLoading) return <Loading label="Loading fleet…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const buses = query.data!;
  const live = buses.filter((bus) => bus.location_status === 'live').length;
  const stale = buses.filter((bus) => bus.location_status === 'stale').length;
  const unassigned = buses.filter((bus) => !bus.driver_id || !bus.route_id).length;
  const seatsTaken = buses.reduce((sum, bus) => sum + (bus.total_seats - bus.seats_available), 0);

  return (
    <>
      <div className="grid grid-4">
        <Stat label="Buses" value={count(buses.length)} hint={`${count(unassigned)} missing a driver or route`} />
        <Stat label="Reporting GPS" value={count(live)} hint={`${count(stale)} stale, ${count(buses.length - live - stale)} offline`} />
        <Stat label="Seats taken" value={count(seatsTaken)} hint="Across the whole fleet right now" />
        <Stat
          label="Open bookings"
          value={count(buses.reduce((sum, bus) => sum + bus.active_bookings, 0))}
          hint="Confirmed and not yet closed"
        />
      </div>

      <Card title="Buses" bodyless>
        {buses.length === 0 ? <Empty label="No buses registered yet." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bus</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>GPS</th>
                  <th>Last ping</th>
                  <th>Movement</th>
                  <th className="num">Seats</th>
                  <th className="num">Open</th>
                  <th className="num">Rating</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((bus) => (
                  <tr key={bus.id}>
                    <td className="mono">{bus.registration}</td>
                    <td>
                      <div>{bus.driver_name || <span className="dim">Unassigned</span>}</div>
                      <div className="dim mono">{bus.driver_phone || ''}</div>
                    </td>
                    <td>
                      <div>{bus.route_name || <span className="dim">Unassigned</span>}</div>
                      {bus.route_name && <div className="dim">{money(bus.route_fare)}</div>}
                    </td>
                    <td><Badge value={bus.location_status} kind="location" /></td>
                    <td className="nowrap">
                      <div>{relative(bus.location_age_seconds)}</div>
                      <div className="dim">{dateTime(bus.last_ping_at)}</div>
                    </td>
                    <td className="dim">{bus.driving_status || '—'}</td>
                    <td className="num">{count(bus.total_seats - bus.seats_available)} / {count(bus.total_seats)}</td>
                    <td className="num">{count(bus.active_bookings)}</td>
                    <td className="num">
                      {bus.rating_count > 0 ? `${bus.rating_avg.toFixed(1)} (${count(bus.rating_count)})` : '—'}
                    </td>
                    <td><Badge value={bus.status} kind="entity" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
