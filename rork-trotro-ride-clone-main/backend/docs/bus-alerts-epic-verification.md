# Bus alerts epic verification

This checklist is the release gate for GitHub epic #9. It complements the automated suites and the operations
runbook; it must be completed against the release environment before enabling 100% rollout.

| Epic criterion | Automated evidence | Release-environment check |
| --- | --- | --- |
| App-closed delivery and exact deep link | Worker delivery and Expo deep-link tests | Tap foreground, background and cold-start pushes on Android and iOS |
| Server-resolved approaching buses | Worker snapshot tests and admin trace | Verify stale GPS, wrong route, full bus, 3 km boundary and no-bus snapshots |
| Retry/multi-worker idempotency | Unique trigger claim, lease, retry and dead-letter tests | Run two workers and confirm one occurrence/job/delivery |
| Once per configured local day | Deterministic Accra/Auckland timezone tests | Exercise a recurring alert across local midnight and restart |
| Cancellation/deletion safety | Cancellation-wins-delivery-lock regression test | Cancel while a worker has claimed a job; confirm no push/banner |
| Notification preferences | Server and local suppression tests | Disable on one device and confirm no server or foreground delivery |
| Immediate/scheduled regressions | Complete booking and scheduled-reservation suites | Smoke-test an immediate booking and one scheduled occurrence |

## Automated baseline

- Run `npm test -- --runInBand` from `backend`.
- Run `npm test -- --runInBand` and `npx tsc --noEmit` from `expo`.
- Apply migrations 001 through 029 to an empty database.
- Set `BUS_ALERT_INTEGRATION_DATABASE_URL` to an isolated, migrated PostGIS database and rerun backend Jest.
- Confirm the admin trace contains configuration, occurrence bus snapshot, job attempts/errors and notification.
- Verify rollout at 0%, a stable partial percentage and 100% before production enablement.

Record device/OS, alert ID, trigger occurrence ID and trace result for every manual release check. A green unit suite
without the PostGIS and physical-device checks is not sufficient evidence for 100% rollout.
