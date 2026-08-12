import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStop, deleteStop, fetchStops } from '../lib/queries';
import type { StopInput } from '../lib/queries';
import type { BusStop } from '../lib/types';
import { Badge, Card, Empty, ErrorState, Loading, Modal } from '../components/ui';

export function StopsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BusStop | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['stops'], queryFn: fetchStops });
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return query.data ?? [];
    return (query.data ?? []).filter((stop) =>
      stop.name.toLocaleLowerCase().includes(needle)
      || stop.type.includes(needle)
      || String(stop.lat).includes(needle)
      || String(stop.lng).includes(needle));
  }, [query.data, search]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['stops'] });
    qc.invalidateQueries({ queryKey: ['route-stops'] });
    qc.invalidateQueries({ queryKey: ['admin-routes'] });
  };
  const create = useMutation({
    mutationFn: createStop,
    onSuccess: (stop) => { setCreating(false); setError(null); setNotice(`Stop “${stop.name}” created.`); refresh(); },
    onError: (err: Error) => { setNotice(null); setError(err.message); },
  });
  const remove = useMutation({
    mutationFn: deleteStop,
    onSuccess: (stop) => { setDeleting(null); setError(null); setNotice(`Stop “${stop.name}” deleted.`); refresh(); },
    onError: (err: Error) => { setDeleting(null); setNotice(null); setError(err.message); },
  });

  return <>
    {notice && <div className="alert success">{notice}</div>}
    {error && <div className="alert">{error}</div>}
    <Card title="Stop catalogue" action={<button onClick={() => setCreating(true)}>Add stop</button>}>
      <div className="field" style={{ maxWidth: 520 }}>
        <label htmlFor="stop-catalogue-search">Search stops or stations</label>
        <input id="stop-catalogue-search" type="search" value={search} placeholder="Search by name, type or coordinates…" onChange={(event) => setSearch(event.target.value)} />
      </div>
      <p className="dim" style={{ marginBottom: 0 }}>Showing {filtered.length} of {(query.data ?? []).length} active stops. Deletion is blocked while a stop is in active use.</p>
    </Card>
    <Card title="Stops and stations" bodyless>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
        : filtered.length === 0 ? <Empty label="No stops match your search." /> : <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Type</th><th>Latitude</th><th>Longitude</th><th>Status</th><th /></tr></thead>
          <tbody>{filtered.map((stop) => <tr key={stop.id}>
            <td>{stop.name}</td><td><Badge value={stop.type} kind="entity" /></td>
            <td className="mono">{stop.lat}</td><td className="mono">{stop.lng}</td>
            <td><Badge value={stop.status} kind="entity" /></td>
            <td className="num"><button className="ghost small" onClick={() => setDeleting(stop)}>Delete</button></td>
          </tr>)}</tbody>
        </table></div>}
    </Card>
    {creating && <StopForm busy={create.isPending} onClose={() => setCreating(false)} onSubmit={(data) => create.mutate(data)} />}
    {deleting && <Modal title={`Delete ${deleting.name}?`} onClose={() => setDeleting(null)}>
      <p style={{ margin: 0 }}>This removes the stop from passenger and driver searches. Historical records are preserved.</p>
      <p className="dim" style={{ margin: 0 }}>If it is still used by an active route, schedule, departure slot or alert, deletion will be rejected.</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="ghost" onClick={() => setDeleting(null)}>Cancel</button><button className="danger" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>{remove.isPending ? 'Deleting…' : 'Delete stop'}</button></div>
    </Modal>}
  </>;
}

function StopForm({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (data: StopInput) => void }) {
  const [name, setName] = useState(''); const [type, setType] = useState<'stop' | 'station'>('stop');
  const [lat, setLat] = useState(''); const [lng, setLng] = useState('');
  const latitude = Number(lat); const longitude = Number(lng);
  const valid = name.trim() !== '' && lat !== '' && lng !== '' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit({ name: name.trim(), type, lat: latitude, lng: longitude }); };
  return <Modal title="Add stop or station" onClose={onClose}><form onSubmit={submit} className="stack" style={{ gap: 12 }}>
    <div className="field"><label htmlFor="new-stop-name">Name</label><input id="new-stop-name" value={name} required onChange={(e) => setName(e.target.value)} /></div>
    <div className="field"><label htmlFor="new-stop-type">Type</label><select id="new-stop-type" value={type} onChange={(e) => setType(e.target.value as 'stop' | 'station')}><option value="stop">Roadside stop</option><option value="station">Station / terminal</option></select></div>
    <div className="grid grid-2"><div className="field"><label htmlFor="new-stop-lat">Latitude</label><input id="new-stop-lat" type="number" step="0.000001" value={lat} required onChange={(e) => setLat(e.target.value)} /></div><div className="field"><label htmlFor="new-stop-lng">Longitude</label><input id="new-stop-lng" type="number" step="0.000001" value={lng} required onChange={(e) => setLng(e.target.value)} /></div></div>
    <p className="dim" style={{ margin: 0 }}>Use coordinates copied from a map. They determine passenger walking-distance ranking.</p>
    <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="ghost" onClick={onClose}>Cancel</button><button type="submit" disabled={busy || !valid}>{busy ? 'Adding…' : 'Add stop'}</button></div>
  </form></Modal>;
}
