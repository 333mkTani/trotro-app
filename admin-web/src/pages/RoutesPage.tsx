import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveRoute, createRoute, createStop, fetchAdminRoutes, fetchRoutePerformance,
  fetchRouteStops, fetchStops, setRouteStops, updateRoute,
} from '../lib/queries';
import type { RouteInput } from '../lib/queries';
import { count, money } from '../lib/format';
import type { BusStop, RouteRow, RouteStop } from '../lib/types';
import { Badge, Card, Empty, ErrorState, Loading, Modal } from '../components/ui';

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'deleted', label: 'Archived' },
  { value: 'all', label: 'All' },
];

export function RoutesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('active');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [archiving, setArchiving] = useState<RouteRow | null>(null);
  const [editingStops, setEditingStops] = useState<RouteRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const routes = useQuery({
    queryKey: ['admin-routes', statusFilter],
    queryFn: () => fetchAdminRoutes(statusFilter),
  });

  const performance = useQuery({
    queryKey: ['route-performance', 30],
    queryFn: () => fetchRoutePerformance(30),
  });

  const performanceById = useMemo(
    () => new Map((performance.data ?? []).map((row) => [row.id, row])),
    [performance.data],
  );

  // Route changes affect the public /routes cache and the dashboard totals,
  // so refresh everything rather than patching a single list in place.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
    queryClient.invalidateQueries({ queryKey: ['route-performance'] });
    queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const handle = (message: string) => {
    setError(null);
    setNotice(message);
    refresh();
  };

  const fail = (err: unknown) => {
    setNotice(null);
    setError(err instanceof Error ? err.message : 'Request failed.');
  };

  const create = useMutation({
    mutationFn: createRoute,
    onSuccess: (route) => { setCreating(false); handle(`Route “${route.name}” created.`); },
    onError: fail,
  });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<RouteInput> & { status?: 'active' | 'paused' } }) =>
      updateRoute(id, body),
    onSuccess: (route) => { setEditing(null); handle(`Route “${route.name}” updated.`); },
    onError: fail,
  });

  const archive = useMutation({
    mutationFn: archiveRoute,
    onSuccess: (result) => {
      setArchiving(null);
      handle(
        `Route “${result.name}” archived. ${count(result.detached.active_buses)} active bus(es) and `
        + `${count(result.detached.open_bookings)} open booking(s) were still attached — reassign them.`,
      );
    },
    onError: fail,
  });

  return (
    <>
      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert">{error}</div>}

      <Card
        title="Routes"
        action={(
          <div className="row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{ width: 130 }}
              aria-label="Filter by status"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button onClick={() => { setError(null); setCreating(true); }}>New route</button>
          </div>
        )}
        bodyless
      >
        {routes.isLoading ? <Loading />
          : routes.isError ? <ErrorState error={routes.error} onRetry={() => routes.refetch()} />
            : routes.data!.length === 0 ? <Empty label="No routes in this view." />
              : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Origin → Destination</th>
                        <th>City</th>
                        <th className="num">Fare</th>
                        <th className="num">Stops</th>
                        <th className="num">Buses</th>
                        <th className="num">Bookings 30d</th>
                        <th className="num">Revenue 30d</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {routes.data!.map((route) => {
                        const stats = performanceById.get(route.id);
                        return (
                          <tr key={route.id}>
                            <td>{route.name}</td>
                            <td className="dim">{route.origin} → {route.destination}</td>
                            <td className="dim">{route.city}</td>
                            <td className="num">{money(route.fare)}</td>
                            <td className="num">{count(route.stops_sequence?.length ?? 0)}</td>
                            <td className="num">{stats ? count(stats.active_buses) : '—'}</td>
                            <td className="num">{stats ? count(stats.bookings) : '—'}</td>
                            <td className="num">{stats ? money(stats.revenue) : '—'}</td>
                            <td><Badge value={route.status} kind="entity" /></td>
                            <td className="nowrap">
                              {route.status === 'deleted' ? <span className="dim">Archived</span> : (
                                <div className="row">
                                  <button
                                    className="ghost small"
                                    onClick={() => { setError(null); setEditing(route); }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="ghost small"
                                    onClick={() => { setError(null); setEditingStops(route); }}
                                  >
                                    Stops
                                  </button>
                                  <button
                                    className="ghost small"
                                    disabled={edit.isPending}
                                    onClick={() => edit.mutate({
                                      id: route.id,
                                      body: { status: route.status === 'active' ? 'paused' : 'active' },
                                    })}
                                  >
                                    {route.status === 'active' ? 'Pause' : 'Resume'}
                                  </button>
                                  <button
                                    className="ghost small"
                                    onClick={() => { setError(null); setArchiving(route); }}
                                  >
                                    Archive
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
      </Card>

      {creating && (
        <RouteFormModal
          title="New route"
          submitLabel={create.isPending ? 'Creating…' : 'Create route'}
          busy={create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(values) => create.mutate(values as RouteInput)}
        />
      )}

      {editing && (
        <RouteFormModal
          title={`Edit ${editing.name}`}
          submitLabel={edit.isPending ? 'Saving…' : 'Save changes'}
          busy={edit.isPending}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(values) => edit.mutate({ id: editing.id, body: values })}
        />
      )}

      {editingStops && (
        <RouteStopsModal
          route={editingStops}
          onClose={() => setEditingStops(null)}
          onSaved={(message) => { setEditingStops(null); handle(message); }}
        />
      )}

      {archiving && (
        <Modal title={`Archive ${archiving.name}?`} onClose={() => setArchiving(null)}>
          <p style={{ margin: 0 }}>
            Routes are never deleted outright — buses and bookings still point at them. Archiving
            sets the route to <strong>deleted</strong> so it disappears from the passenger and driver
            apps, while existing records stay intact and auditable.
          </p>
          <p className="dim" style={{ margin: 0 }}>
            Any bus still assigned to this route will keep the assignment until you move it.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="ghost" onClick={() => setArchiving(null)}>Cancel</button>
            <button
              className="danger"
              disabled={archive.isPending}
              onClick={() => archive.mutate(archiving.id)}
            >
              {archive.isPending ? 'Archiving…' : 'Archive route'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * Stop editor for one route. The whole ordered list is held locally and saved
 * in a single PUT — the API replaces the route's stops wholesale, so there is
 * no half-applied state to reconcile if the admin reorders several at once.
 */
function RouteStopsModal({ route, onClose, onSaved }: {
  route: RouteRow;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  // null until the admin touches something, so the server order stays authoritative.
  const [draft, setDraft] = useState<string[] | null>(null);
  const [picked, setPicked] = useState('');
  const [search, setSearch] = useState('');
  const [addingStop, setAddingStop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attached = useQuery({
    queryKey: ['route-stops', route.id],
    queryFn: () => fetchRouteStops(route.id),
  });
  const catalogue = useQuery({ queryKey: ['stops'], queryFn: fetchStops });

  const saved = useMemo(() => (attached.data ?? []).map((stop) => stop.id), [attached.data]);
  const order = draft ?? saved;

  // Attached stops carry their own details, so the list still renders while the
  // full catalogue is loading.
  const stopsById = useMemo(() => {
    const map = new Map<string, RouteStop | BusStop>();
    for (const stop of catalogue.data ?? []) map.set(stop.id, stop);
    for (const stop of attached.data ?? []) map.set(stop.id, stop);
    return map;
  }, [catalogue.data, attached.data]);

  // There are hundreds of stops system-wide, so the picker is filtered by name
  // rather than asking the admin to scroll the whole catalogue.
  const needle = search.trim().toLowerCase();
  const available = (catalogue.data ?? []).filter((stop) =>
    !order.includes(stop.id) && (needle === '' || stop.name.toLowerCase().includes(needle)));
  const dirty = draft !== null && draft.join(',') !== saved.join(',');

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  const save = useMutation({
    mutationFn: () => setRouteStops(route.id, order),
    onSuccess: (stops) => {
      queryClient.invalidateQueries({ queryKey: ['route-stops', route.id] });
      onSaved(`Route “${route.name}” now has ${count(stops.length)} stop(s).`);
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not save the stops.'),
  });

  const addStop = useMutation({
    mutationFn: createStop,
    onSuccess: (stop) => {
      setAddingStop(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      setDraft([...order, stop.id]);
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not create the stop.'),
  });

  return (
    <Modal title={`Stops on ${route.name}`} onClose={onClose}>
      {error && <div className="alert">{error}</div>}

      <p className="dim" style={{ margin: 0, fontSize: 12 }}>
        Stops are listed in travel order from {route.origin} to {route.destination}. The passenger
        app derives the return direction by reading the same list backwards, so add each stop once,
        in the outbound order.
      </p>

      {attached.isLoading ? <Loading />
        : attached.isError ? <ErrorState error={attached.error} onRetry={() => attached.refetch()} />
          : order.length === 0 ? <Empty label="No stops on this route yet." />
            : (
              <ol className="seq">
                {order.map((id, index) => {
                  const stop = stopsById.get(id);
                  return (
                    <li key={id}>
                      <span className="seq-num">{index + 1}</span>
                      <span className="seq-name">
                        {stop?.name ?? id}
                        {stop?.type === 'station' && <span className="badge info">Station</span>}
                      </span>
                      <span className="row">
                        <button
                          className="ghost small" aria-label={`Move ${stop?.name ?? id} earlier`}
                          disabled={index === 0} onClick={() => move(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="ghost small" aria-label={`Move ${stop?.name ?? id} later`}
                          disabled={index === order.length - 1} onClick={() => move(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => setDraft(order.filter((other) => other !== id))}
                        >
                          Remove
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

      <div className="field">
        <label htmlFor="stop-search">Add an existing stop</label>
        <input
          id="stop-search" value={search} placeholder="Filter stops by name…"
          onChange={(event) => { setSearch(event.target.value); setPicked(''); }}
        />
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <select
            value={picked}
            aria-label="Stop to add"
            disabled={catalogue.isLoading || available.length === 0}
            onChange={(event) => setPicked(event.target.value)}
          >
            <option value="">
              {catalogue.isLoading ? 'Loading stops…'
                : available.length === 0 ? (needle ? 'No stop matches that name' : 'Every stop is already on this route')
                  : `Choose a stop… (${available.length})`}
            </option>
            {available.map((stop) => (
              <option key={stop.id} value={stop.id}>{stop.name}</option>
            ))}
          </select>
        </div>
        <button
          className="ghost"
          disabled={!picked}
          onClick={() => { setDraft([...order, picked]); setPicked(''); setSearch(''); }}
        >
          Add
        </button>
      </div>

      {addingStop ? (
        <NewStopForm
          busy={addStop.isPending}
          onCancel={() => setAddingStop(false)}
          onSubmit={(values) => addStop.mutate(values)}
        />
      ) : (
        <button className="ghost small" onClick={() => setAddingStop(true)}>
          Stop not listed? Create a new one
        </button>
      )}

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save stop order'}
        </button>
      </div>
    </Modal>
  );
}

/** Creates a brand-new bus stop. A DB trigger derives the PostGIS point from lat/lng. */
function NewStopForm({ busy, onCancel, onSubmit }: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: { name: string; type: 'stop' | 'station'; lat: number; lng: number }) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'stop' | 'station'>('stop');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const latValue = Number(lat);
  const lngValue = Number(lng);
  const valid = name.trim() !== ''
    && lat !== '' && Number.isFinite(latValue) && Math.abs(latValue) <= 90
    && lng !== '' && Number.isFinite(lngValue) && Math.abs(lngValue) <= 180;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ name: name.trim(), type, lat: latValue, lng: lngValue });
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="stop-name">Stop name</label>
          <input
            id="stop-name" value={name} required placeholder="Tetteh Quarshie"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="stop-type">Type</label>
          <select
            id="stop-type" value={type}
            onChange={(event) => setType(event.target.value as 'stop' | 'station')}
          >
            <option value="stop">Roadside stop</option>
            <option value="station">Station / terminal</option>
          </select>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="stop-lat">Latitude</label>
          <input
            id="stop-lat" type="number" step="0.000001" value={lat} required placeholder="5.6037"
            onChange={(event) => setLat(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="stop-lng">Longitude</label>
          <input
            id="stop-lng" type="number" step="0.000001" value={lng} required placeholder="-0.1870"
            onChange={(event) => setLng(event.target.value)}
          />
        </div>
      </div>

      <p className="dim" style={{ margin: 0, fontSize: 12 }}>
        Coordinates drive the nearby-stop search in the passenger app, so take them from a map
        rather than estimating. The new stop is appended to the end of this route — move it into
        position before saving.
      </p>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={busy || !valid}>
          {busy ? 'Creating…' : 'Create stop'}
        </button>
      </div>
    </form>
  );
}

type FormValues = Partial<RouteInput> & { status?: 'active' | 'paused' };

function RouteFormModal({ title, submitLabel, busy, initial, onClose, onSubmit }: {
  title: string;
  submitLabel: string;
  busy: boolean;
  initial?: RouteRow;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [fare, setFare] = useState(initial ? String(initial.fare) : '');
  const [distanceKm, setDistanceKm] = useState(initial?.distance_km != null ? String(initial.distance_km) : '');
  const [durationMin, setDurationMin] = useState(initial?.duration_min != null ? String(initial.duration_min) : '');
  const [city, setCity] = useState(initial?.city ?? 'accra');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values: FormValues = {
      name: name.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      fare: Number(fare),
      city: city.trim(),
    };
    if (distanceKm !== '') values.distanceKm = Number(distanceKm);
    if (durationMin !== '') values.durationMin = Number(durationMin);
    onSubmit(values);
  };

  const fareValue = Number(fare);
  const valid = name.trim() && origin.trim() && destination.trim()
    && fare !== '' && Number.isFinite(fareValue) && fareValue >= 0;

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="route-name">Route name</label>
          <input
            id="route-name" value={name} required
            placeholder="Madina → Circle"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="route-origin">Origin</label>
            <input
              id="route-origin" value={origin} required
              onChange={(event) => setOrigin(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="route-destination">Destination</label>
            <input
              id="route-destination" value={destination} required
              onChange={(event) => setDestination(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="route-fare">Fare (GH₵)</label>
            <input
              id="route-fare" type="number" min="0" step="0.01" value={fare} required
              onChange={(event) => setFare(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="route-city">City</label>
            <input
              id="route-city" value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="route-distance">Distance (km, optional)</label>
            <input
              id="route-distance" type="number" min="0" step="0.1" value={distanceKm}
              onChange={(event) => setDistanceKm(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="route-duration">Duration (min, optional)</label>
            <input
              id="route-duration" type="number" min="0" step="1" value={durationMin}
              onChange={(event) => setDurationMin(event.target.value)}
            />
          </div>
        </div>

        <p className="dim" style={{ margin: 0, fontSize: 12 }}>
          Changing the fare applies to new bookings only. Bookings already priced keep the fare they
          were quoted, so in-flight rides are never re-priced underneath a passenger.
        </p>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy || !valid}>{submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
