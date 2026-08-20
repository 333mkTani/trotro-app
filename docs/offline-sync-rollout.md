# Offline Sync Integration, Observability, and Pilot Rollout

## Scope

This document is the release gate for the offline-first synchronization epic tracked by issue #14. The feature is intentionally bounded: route, stop, active-ride reads, driver GPS, driver availability, and driver driving-status intents may use local persistence. Seat capacity, booking confirmation, assignment, wallet balances, and payment operations remain server-authoritative.

## Integration test matrix

| Scenario | Expected result | Gate |
|---|---|---|
| Launch with a populated route/stop cache and no network | Passenger can search saved routes and stops; a stale-data notice is shown when the snapshot is older than five minutes. | Must pass |
| Launch with a cached pending or confirmed ride and no network | The last ride details render, but live booking and driver status are clearly marked as potentially stale. | Must pass |
| Driver records GPS while offline | Points are written to SQLite, bounded to 200 points, and stale points older than 15 minutes are pruned. | Must pass |
| Driver changes availability or driving status while offline | The action is applied optimistically, shown as pending, and submitted once connectivity returns. | Must pass |
| Driver changes seat capacity while offline | The control is disabled; no false local confirmation or unsupported queue event is created. | Must pass |
| Connectivity returns after queued mutations | Events are sent in order with their original idempotency keys and removed only after an accepted or duplicate acknowledgement. | Must pass |
| A mutation is submitted twice | The backend returns `duplicate` and does not apply the business mutation twice. | Must pass |
| A mutation conflicts with server state | The event remains visible as a conflict and is not silently discarded. | Must pass |
| Authentication expires before sync | The queue remains local, the app reports an authentication problem, and data is not sent without a valid token. | Must pass |
| User A signs out and User B signs in on the same device | User A's queue, cursor, and cache are removed before User B's data is used. | Must pass |
| App is terminated during sync | The next launch retries safely using the same event and idempotency key. | Must pass |

## Observability

Both mobile apps now record non-sensitive in-process synchronization counters for queued mutations, accepted mutations, duplicates, conflicts, rejections, sync attempts, successful syncs, sync errors, last successful sync time, and last error. Payloads, tokens, coordinates, booking IDs, and personal data are not included in these metrics.

The production monitoring adapter should export these counters to the selected crash/error or analytics service during the pilot. At minimum, operators should monitor sync error rate, conflict rate, retry-limit events, queue age, queue depth, and the percentage of active users with a successful sync in the last 24 hours. Backend logs should be correlated with the client event ID and idempotency key, never with access tokens.

## Feature flags

The mobile rollout is controlled at build time through the following Expo variables:

```text
EXPO_PUBLIC_OFFLINE_SYNC_ENABLED=true
EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT=0
```

The rollout percentage is assigned deterministically from the authenticated user ID, so a user stays in the same cohort across sessions. A value of `0` disables the feature for all users; `100` enables it for all users. The safe default is enabled with a gradual percentage configured per build environment. Payment and booking confirmation behavior is not enabled by this flag and remains server-authoritative.

## Pilot stages

The first stage should use internal accounts and a seeded staging backend. The second stage should use a small driver cohort and a small passenger cohort in one operating region. The third stage should expand to approximately 10 percent of users only after the first cohort has completed at least one offline/reconnect cycle without unresolved conflicts. The final stage can move toward 100 percent after monitoring remains stable for a defined observation window.

Each stage requires a release checklist covering database migrations, backend sync endpoints, SecureStore migration, mobile builds, feature-flag values, dashboard access, alert routing, and rollback instructions. Rollback means setting the rollout percentage to zero in a new mobile build or disabling the feature before release; already queued data must remain safe and must not be interpreted as confirmed bookings or payments.

## Abort criteria

Pause the rollout if sync errors exceed the agreed baseline, if conflict or rejection rates rise unexpectedly, if a duplicate event changes a business record twice, if user data appears across accounts, if GPS queue growth threatens device storage, if authentication tokens are written to ordinary storage, or if any UI claims that an offline booking, seat, payment, wallet, or cancellation is confirmed.

## Device acceptance

Before closing issue #21, test on at least one recent Android device and one recent iPhone, including airplane mode, intermittent connectivity, process termination, device restart, app upgrade with legacy data, logout/account switch, SecureStore migration, background location permissions, and a real staging backend with the production-like database migration applied.
