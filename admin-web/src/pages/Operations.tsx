import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRuntimeCounters, fetchTrace, traceBusAlert, traceScheduleOccurrence } from '../lib/queries';
import { count } from '../lib/format';
import { Card, Empty, ErrorState, Loading } from '../components/ui';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRACE_KINDS = {
  booking: { label: 'Booking payments', fetch: fetchTrace },
  occurrence: { label: 'Scheduled occurrence', fetch: traceScheduleOccurrence },
  alert: { label: 'Bus alert', fetch: traceBusAlert },
} as const;

type TraceKind = keyof typeof TRACE_KINDS;

export function OperationsPage() {
  return (
    <>
      <TraceLookup />
      <RuntimeCounters />
    </>
  );
}

function TraceLookup() {
  const [kind, setKind] = useState<TraceKind>('booking');
  const [id, setId] = useState('');
  const [target, setTarget] = useState<{ kind: TraceKind; id: string } | null>(null);

  const query = useQuery({
    queryKey: ['trace-lookup', target?.kind, target?.id],
    queryFn: () => TRACE_KINDS[target!.kind].fetch(target!.id),
    enabled: target !== null,
    retry: false,
  });

  const trimmed = id.trim();
  const valid = UUID_RE.test(trimmed);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) setTarget({ kind, id: trimmed });
  };

  return (
    <Card title="Trace lookup">
      <p className="dim" style={{ marginTop: 0 }}>
        Pull the full server-side trace for one record — every payment leg, wallet movement and
        reconciliation event the API recorded against it. Read-only.
      </p>

      <form onSubmit={submit} className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="trace-kind">Record type</label>
          <select
            id="trace-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as TraceKind)}
          >
            {(Object.keys(TRACE_KINDS) as TraceKind[]).map((value) => (
              <option key={value} value={value}>{TRACE_KINDS[value].label}</option>
            ))}
          </select>
        </div>

        <div className="field" style={{ flex: 1, minWidth: 320 }}>
          <label htmlFor="trace-id">Record id</label>
          <input
            id="trace-id"
            className="mono"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={id}
            onChange={(event) => setId(event.target.value)}
          />
        </div>

        <button type="submit" disabled={!valid}>Trace</button>
      </form>

      {trimmed !== '' && !valid && (
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>
          That is not a UUID. Copy the id straight from the bookings table or a server log.
        </p>
      )}

      {target && (
        query.isLoading ? <Loading label="Fetching trace…" />
          : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
            : <pre className="json">{JSON.stringify(query.data, null, 2)}</pre>
      )}
    </Card>
  );
}

type CounterRow = { name: string; labels: string; value: number };

/** Splits `event_name{bus=abc,reason=late}` into a name and a readable label string. */
const parseKey = (key: string): { name: string; labels: string } => {
  const open = key.indexOf('{');
  if (open === -1 || !key.endsWith('}')) return { name: key, labels: '' };
  return {
    name: key.slice(0, open),
    labels: key.slice(open + 1, -1).split(',').join(' · '),
  };
};

function RuntimeCounters() {
  const query = useQuery({
    queryKey: ['runtime-counters'],
    queryFn: fetchRuntimeCounters,
    refetchInterval: 30_000,
  });

  const groups = useMemo(() => {
    const byName = new Map<string, CounterRow[]>();
    for (const [key, value] of Object.entries(query.data ?? {})) {
      const { name, labels } = parseKey(key);
      const row = { name, labels, value: Number(value) || 0 };
      const existing = byName.get(name);
      if (existing) existing.push(row);
      else byName.set(name, [row]);
    }
    return [...byName.entries()]
      .map(([name, rows]) => ({
        name,
        total: rows.reduce((sum, row) => sum + row.value, 0),
        rows: rows.sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return (
    <Card
      title="Runtime counters"
      action={(
        <button className="ghost small" disabled={query.isFetching} onClick={() => query.refetch()}>
          {query.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      )}
    >
      <p className="dim" style={{ marginTop: 0 }}>
        Instrumentation counters held in memory by the API process — schedule dispatch, bus alerts
        and payment webhooks all report here. They reset to zero on every deploy or restart, and a
        single process is being sampled, so treat them as a live health signal rather than history.
      </p>

      {query.isLoading ? <Loading />
        : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : groups.length === 0
            ? <Empty label="No counters recorded since the API last restarted." />
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Labels</th>
                      <th className="num">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => group.rows.map((row, index) => (
                      <tr key={`${group.name}:${row.labels}`}>
                        <td className="mono">
                          {index === 0 ? group.name : ''}
                          {index === 0 && group.rows.length > 1 && (
                            <span className="dim"> ({count(group.total)} total)</span>
                          )}
                        </td>
                        <td className="dim mono">{row.labels || '—'}</td>
                        <td className="num">{count(row.value)}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
    </Card>
  );
}
