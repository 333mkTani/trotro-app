import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchOverview, fetchSeries } from '../lib/queries';
import { count, dateTime, money } from '../lib/format';
import { Badge, Card, Empty, ErrorState, Loading, Stat } from '../components/ui';
import { RevenueChart } from '../components/RevenueChart';

const RANGES = [7, 30, 90];

export function OverviewPage() {
  const [days, setDays] = useState(30);

  const overview = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    // The endpoint is cached for 15s server-side; polling matches that.
    refetchInterval: 20_000,
  });

  const series = useQuery({
    queryKey: ['series', days],
    queryFn: () => fetchSeries(days),
  });

  if (overview.isLoading) return <Loading label="Loading dashboard…" />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;

  const data = overview.data!;
  const { revenue, bookings, fleet, people, routes, wallets } = data;
  const seatsUsed = fleet.total_seats - fleet.seats_available;
  const occupancy = fleet.total_seats > 0 ? Math.round((seatsUsed / fleet.total_seats) * 100) : 0;

  return (
    <>
      <div className="grid grid-4">
        <Stat
          label="Collected today"
          value={money(revenue.collectedToday)}
          hint={`${money(revenue.grossCollected)} gross all time`}
        />
        <Stat
          label="Net collected"
          value={money(revenue.netCollected)}
          hint={`${money(revenue.refunded)} refunded`}
        />
        <Stat
          label="Deposits held"
          value={money(revenue.depositsHeld)}
          hint={`${count(revenue.depositsHeldBookings)} open booking(s)`}
        />
        <Stat
          label="Bookings today"
          value={count(bookings.today)}
          hint={`${count(bookings.total)} all time`}
        />
      </div>

      <div className="grid grid-4">
        <Stat
          label="Buses online"
          value={`${count(fleet.online)} / ${count(fleet.active)}`}
          hint={`${count(fleet.en_route)} en route · ${count(fleet.total)} registered`}
        />
        <Stat
          label="Seat occupancy"
          value={`${occupancy}%`}
          hint={`${count(seatsUsed)} of ${count(fleet.total_seats)} seats taken`}
        />
        <Stat
          label="People"
          value={count(people.passengers)}
          hint={`${count(people.drivers)} drivers · ${count(people.joined_today)} joined today`}
        />
        <Stat
          label="Wallet float"
          value={money(wallets.total)}
          hint={`${money(wallets.drivers)} drivers · ${money(wallets.passengers)} passengers`}
        />
      </div>

      {(revenue.pendingPayments > 0 || revenue.pendingRefunds > 0) && (
        <div className="alert info">
          {count(revenue.pendingPayments)} payment(s) worth {money(revenue.pendingAmount)} are still
          unsettled, including {count(revenue.pendingRefunds)} pending refund(s).
        </div>
      )}

      <Card
        title="Gross collections"
        action={(
          <div className="row">
            {RANGES.map((range) => (
              <button
                key={range}
                className={range === days ? 'small' : 'ghost small'}
                onClick={() => setDays(range)}
              >
                {range}d
              </button>
            ))}
          </div>
        )}
      >
        {series.isLoading ? <Loading />
          : series.isError ? <ErrorState error={series.error} onRetry={() => series.refetch()} />
            : <RevenueChart points={series.data!.points} />}
      </Card>

      <div className="grid grid-2">
        <Card title="Bookings by status">
          {bookings.byStatus.length === 0 ? <Empty label="No bookings yet." /> : (
            <div className="stack" style={{ gap: 10 }}>
              {bookings.byStatus.map((row) => {
                const share = bookings.total > 0 ? (row.total / bookings.total) * 100 : 0;
                return (
                  <div className="bar-row" key={row.status}>
                    <Badge value={row.status} kind="booking" />
                    <span className="bar-track">
                      <span className="bar-fill" style={{ width: `${share}%` }} />
                    </span>
                    <span className="num">{count(row.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Payment states">
          {bookings.byPaymentStatus.length === 0 ? <Empty label="No payments yet." /> : (
            <div className="stack" style={{ gap: 10 }}>
              {bookings.byPaymentStatus.map((row) => {
                const share = bookings.total > 0 ? (row.total / bookings.total) * 100 : 0;
                return (
                  <div className="bar-row" key={row.payment_status}>
                    <Badge value={row.payment_status} kind="payment" />
                    <span className="bar-track">
                      <span className="bar-fill" style={{ width: `${share}%` }} />
                    </span>
                    <span className="num">{count(row.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Latest bookings"
        action={<Link to="/bookings"><button className="ghost small">View all</button></Link>}
        bodyless
      >
        {data.recentBookings.length === 0 ? <Empty label="No bookings yet." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Passenger</th>
                  <th>Trip</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="num">Fare</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <div>{booking.passenger_name || '—'}</div>
                      <div className="dim mono">{booking.passenger_phone || ''}</div>
                    </td>
                    <td>{booking.pickup_stop_name} → {booking.destination_stop_name}</td>
                    <td className="dim">{booking.route_name || '—'}</td>
                    <td><Badge value={booking.status} kind="booking" /></td>
                    <td><Badge value={booking.payment_status} kind="payment" /></td>
                    <td className="num">{money(booking.total_fare || booking.ride_fare)}</td>
                    <td className="dim nowrap">{dateTime(booking.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="dim" style={{ fontSize: 12 }}>
        {count(routes.active)} active route(s), {count(routes.paused)} paused,{' '}
        {count(routes.archived)} archived · snapshot taken {dateTime(data.generatedAt)}
      </div>
    </>
  );
}
