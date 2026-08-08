# Scheduled reservations operations runbook

## Rollout

Scheduled reservations are off by default. Set `SCHEDULED_RESERVATIONS_ENABLED=true` and
`SCHEDULED_RESERVATIONS_ROLLOUT_PERCENT=1` to start with a deterministic 1% passenger cohort.
Increase gradually through 5, 25, 50 and 100 percent. Immediate bookings do not use this flag.

Migrations 023-025 are additive and must be applied before enabling the flag. The worker then
idempotently generates the next 14 days for enabled active schedules. Re-running a cycle is the
safe backfill and reconciliation operation.

## Workers and test clock

Production uses the `trotro-schedule-worker` Render background worker (`npm run worker:schedule`).
After the dedicated worker is healthy, set `SCHEDULE_WORKER_IN_WEB=false` on the API so the web
process does not also schedule cycles. Leave it true during worker setup; the advisory lock makes
that overlap safe and prevents a processing gap if the new worker is missing configuration.
The worker needs the same `DATABASE_URL`, rollout values and `FIREBASE_SERVICE_ACCOUNT` as the API.
Render does not copy `sync: false` secrets onto an existing Blueprint service automatically; verify
them in the worker's Environment page before enabling the rollout.

Dispatch and boarding lifecycle reconciliation run every minute. A PostgreSQL advisory lock spans
each complete cycle, so deploy overlap or an accidentally enabled second worker safely skips rather
than processing concurrently. Notification claims additionally use row locking and `skip locked`.
In the test environment only,
`SCHEDULE_TEST_NOW=<ISO timestamp>` freezes the default worker clock for previous-evening,
boarding-window and expiry scenarios.

For a single paid always-on API without a separate worker, omit the worker service and set
`SCHEDULE_WORKER_IN_WEB=true`. Never set it to false unless a dedicated worker or scheduled invoker
is actually running. Free web instances can sleep and are not reliable schedule processors.

## Retries, tracing and reconciliation

Notification delivery retries after 1-6 minutes based on attempt count. A job is marked sent only
after in-app persistence and any configured push delivery succeed. Unique occurrence, recipient
and event constraints prevent duplicate user-visible events.

- `GET /api/admin/schedules/occurrences/:id` returns the occurrence, responses, held capacity,
  boarding-code state, outbox jobs and in-app notifications.
- `GET /api/admin/schedules/metrics` returns process-local counters.
- Structured JSON logs can be searched by `occurrenceId` and event name.

If a cycle fails, leave rows intact, repair the dependency and restart or wait for the next cycle.
Never manually mark an occurrence accepted without its held future-capacity row.

Alert on repeated `schedule.notification.failed`, worker failures, growing pending outbox depth,
or unexpected increases in unmatched and expired occurrences.
