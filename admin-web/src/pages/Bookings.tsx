import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchAdminRoutes, fetchBookings, fetchTrace } from '../lib/queries';
import type { BookingFilters } from '../lib/queries';
import { count, dateTime, money, titleCase } from '../lib/format';
import type { Booking } from '../lib/types';
import { Badge, Card, Drawer, Empty, ErrorState, Loading } from '../components/ui';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'expired'];
const PAYMENT_STATUSES = [
  'unpaid', 'deposit_pending', 'deposit_paid', 'balance_pending', 'fully_paid',
  'refund_pending', 'partially_refunded', 'refunded', 'failed',
];
const PAGE_SIZE = 25;

export function BookingsPage() {
  const [filters, setFilters] = useState<BookingFilters>({});
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Booking | null>(null);

  const routes = useQuery({ queryKey: ['admin-routes', 'active'], queryFn: () => fetchAdminRoutes('active') });

  const query = useQuery({
    queryKey: ['bookings', filters, offset],
    queryFn: () => fetchBookings({ ...filters, limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  });

  const patch = (next: Partial<BookingFilters>) => {
    setOffset(0);
    setFilters((current) => {
      const merged = { ...current, ...next };
      for (const key of Object.keys(merged) as (keyof BookingFilters)[]) {
        if (merged[key] === '' || merged[key] === undefined) delete merged[key];
      }
      return merged;
    });
  };

  const reset = () => { setFilters({}); setSearch(''); setOffset(0); };

  const page = query.data;

  return (
    <>
      <Card title="Filters" action={<button className="ghost small" onClick={reset}>Reset</button>}>
        <div className="filters">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={filters.status ?? ''}
              onChange={(event) => patch({ status: event.target.value })}
            >
              <option value="">All</option>
              {STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="paymentStatus">Payment</label>
            <select
              id="paymentStatus"
              value={filters.paymentStatus ?? ''}
              onChange={(event) => patch({ paymentStatus: event.target.value })}
            >
              <option value="">All</option>
              {PAYMENT_STATUSES.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="routeId">Route</label>
            <select
              id="routeId"
              value={filters.routeId ?? ''}
              onChange={(event) => patch({ routeId: event.target.value })}
            >
              <option value="">All</option>
              {(routes.data ?? []).map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="from">From</label>
            <input
              id="from" type="date" value={filters.from ?? ''}
              onChange={(event) => patch({ from: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="to">To</label>
            <input
              id="to" type="date" value={filters.to ?? ''}
              onChange={(event) => patch({ to: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="search">Search</label>
            <form
              onSubmit={(event) => { event.preventDefault(); patch({ search }); }}
            >
              <input
                id="search"
                placeholder="Name, phone, stop or booking id"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onBlur={() => patch({ search })}
              />
            </form>
          </div>
        </div>
      </Card>

      <Card
        title={page ? `${count(page.total)} booking(s)` : 'Bookings'}
        action={page && page.total > 0 ? (
          <div className="row">
            <button
              className="ghost small"
              disabled={offset === 0 || query.isFetching}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </button>
            <span className="dim" style={{ fontSize: 12 }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, page.total)}
            </span>
            <button
              className="ghost small"
              disabled={!page.hasMore || query.isFetching}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        ) : undefined}
        bodyless
      >
        {query.isLoading ? <Loading />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
            : page!.bookings.length === 0 ? <Empty label="No bookings match these filters." />
              : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Passenger</th>
                        <th>Trip</th>
                        <th>Driver / bus</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th className="num">Fare</th>
                        <th className="num">Outstanding</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page!.bookings.map((booking) => (
                        <tr
                          key={booking.id}
                          className="clickable"
                          onClick={() => setSelected(booking)}
                        >
                          <td>
                            <div>{booking.passenger_name || '—'}</div>
                            <div className="dim mono">{booking.passenger_phone || ''}</div>
                          </td>
                          <td>
                            <div>{booking.pickup_stop_name} → {booking.destination_stop_name}</div>
                            <div className="dim">{booking.route_name || '—'}</div>
                          </td>
                          <td>
                            <div>{booking.driver_name || '—'}</div>
                            <div className="dim mono">{booking.bus_registration || ''}</div>
                          </td>
                          <td><Badge value={booking.status} kind="booking" /></td>
                          <td><Badge value={booking.payment_status} kind="payment" /></td>
                          <td className="num">{money(booking.total_fare || booking.ride_fare)}</td>
                          <td className="num">{money(booking.remaining_balance)}</td>
                          <td className="dim nowrap">{dateTime(booking.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </Card>

      {selected && <BookingDrawer booking={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function BookingDrawer({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const trace = useQuery({
    queryKey: ['trace', booking.id],
    queryFn: () => fetchTrace(booking.id),
  });

  return (
    <Drawer title="Booking detail" onClose={onClose}>
      <Card title="Trip">
        <dl className="kv">
          <dt>Booking id</dt><dd className="mono">{booking.id}</dd>
          <dt>Passenger</dt><dd>{booking.passenger_name || '—'} <span className="dim mono">{booking.passenger_phone}</span></dd>
          <dt>Driver</dt><dd>{booking.driver_name || '—'} <span className="dim mono">{booking.driver_phone || ''}</span></dd>
          <dt>Bus</dt><dd className="mono">{booking.bus_registration || '—'}</dd>
          <dt>Route</dt><dd>{booking.route_name || '—'}</dd>
          <dt>Pickup</dt><dd>{booking.pickup_stop_name}</dd>
          <dt>Destination</dt><dd>{booking.destination_stop_name}</dd>
          <dt>Wanted by</dt><dd>{dateTime(booking.desired_arrival_time)}</dd>
        </dl>
      </Card>

      <Card title="Money">
        <dl className="kv">
          <dt>Status</dt><dd><Badge value={booking.status} kind="booking" /></dd>
          <dt>Payment status</dt><dd><Badge value={booking.payment_status} kind="payment" /></dd>
          <dt>Total fare</dt><dd>{money(booking.total_fare || booking.ride_fare)}</dd>
          <dt>Deposit</dt><dd>{money(booking.deposit_amount)}</dd>
          <dt>Remaining balance</dt><dd>{money(booking.remaining_balance)}</dd>
          <dt>Method</dt><dd>{titleCase(booking.ride_payment_method)}</dd>
        </dl>
      </Card>

      <Card title="Timeline">
        <dl className="kv">
          <dt>Created</dt><dd>{dateTime(booking.created_at)}</dd>
          <dt>Confirmed</dt><dd>{dateTime(booking.confirmed_at)}</dd>
          <dt>Boarded</dt><dd>{dateTime(booking.boarded_at)}</dd>
          <dt>Arrived</dt><dd>{dateTime(booking.arrived_at)}</dd>
          <dt>Completed</dt><dd>{dateTime(booking.completed_at)}</dd>
          <dt>Cancelled</dt><dd>{dateTime(booking.cancelled_at)}</dd>
          <dt>Expired</dt><dd>{dateTime(booking.expired_at)}</dd>
        </dl>
      </Card>

      <Card title="Payment trace">
        {trace.isLoading ? <Loading label="Tracing payments…" />
          : trace.isError ? <ErrorState error={trace.error} onRetry={() => trace.refetch()} />
            : <pre className="json">{JSON.stringify(trace.data, null, 2)}</pre>}
      </Card>
    </Drawer>
  );
}
