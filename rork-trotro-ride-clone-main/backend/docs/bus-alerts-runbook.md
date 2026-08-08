# Bus alerts operations runbook

## Deployment and rollout

Apply migrations 026 through 029 before starting workers. Bus-alert rollout is independent of scheduled reservations:

- `BUS_ALERTS_ENABLED=false` is the emergency global stop.
- `BUS_ALERTS_ENABLED=true` with `BUS_ALERTS_ROLLOUT_PERCENT=0` exposes no new alert creation or evaluation.
- Increase the percentage through 5, 25, 50 and 100. Assignment is a stable hash of passenger ID.
- `BUS_ALERT_WORKER_INTERVAL_MS` defaults to 30 seconds and cannot be lower than 5 seconds.

Before increasing rollout, check `GET /api/admin/bus-alerts/metrics` and sample traces from
`GET /api/admin/bus-alerts/alerts/:alertId`. Immediate bookings and scheduled reservations do not use this flag.

## Lifecycle and trace

The worker evaluates active alerts, claims a unique `(alert_id, local_date)` trigger, captures a PostGIS-filtered
bus snapshot, creates the in-app record, emits the user socket event and sends push. The admin trace returns the
canonical alert configuration and user preference, every trigger occurrence and captured bus snapshot, notification
jobs with attempts/errors, and in-app notifications. Logs always include `alertId` and, after claiming, the
`triggerOccurrenceId`.

Relevant counters are `bus_alert.created`, `evaluated`, `trigger.created`, `skipped`, `delivered`, `retried`,
`failed`, and `cancelled`. Skips are labelled `not_due`, `idempotency`, `rollout`, or `preference`.

## Retry, dead letter and reconciliation

Processing leases older than five minutes are reclaimed automatically. Failures return to pending with linear
backoff based on attempts. The sixth failed attempt moves the job to `dead_letter`. Inspect the alert trace and
`last_error`, correct the dependency (FCM, route data, PostGIS, or token), then reconcile deliberately by changing
the job to `pending`, resetting `attempts` only after the root cause is fixed, and setting `next_attempt_at=now()`.
Never create a second trigger occurrence manually.

Cancellation and deletion cancel pending trigger occurrences and their pending/processing jobs. A race already
holding a job remains safe because persistence and state transitions are idempotent and the trace retains history.

## Incident response

1. Set rollout to 0% for a scoped stop, or set the master flag false for an emergency stop, then restart workers.
2. Record the alert ID and fetch its admin trace. Check canonical route/stop, timezone, local date and preference.
3. Check captured buses for stale GPS (older than 10 minutes), wrong route, zero seats, or distance beyond 3 km.
4. Check job status, attempts and `last_error`; confirm push credentials and socket health.
5. Correct the cause and reconcile dead letters as described above.
6. Restore rollout gradually while watching retry/failure ratios and sampling successful traces.

## Verification

Run backend and Expo suites plus TypeScript. For real spatial verification, set
`BUS_ALERT_INTEGRATION_DATABASE_URL` to an isolated, fully migrated PostgreSQL database with PostGIS and run the
backend Jest suite. The integration test verifies the 3 km inclusive boundary and trigger uniqueness. Exercise
foreground, background and cold-start notification taps on physical Android/iOS devices before 100% rollout.
