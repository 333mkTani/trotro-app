# Offline-first synchronization protocol

Status: proposed foundation for [issue #14](https://github.com/333mkTani/trotro-app/issues/14)

This document defines the safe boundary for offline behavior in the passenger and driver apps. Offline mode is designed to preserve useful read data and queue safe operational intents. It is not a second authority for bookings, seats, payments, wallets, or driver assignments.

## Non-negotiable product rule

> A device may display cached data or hold a pending intent, but it must not display a seat, booking, payment, wallet balance, cancellation, boarding event, or driver assignment as confirmed until the backend has accepted it.

The backend remains authoritative for all shared state and all financial effects. A client-generated timestamp is informational only and must never determine the final order of financial or booking events.

## Synchronization model

Each authenticated device maintains two classes of local data:

| Class | Examples | Offline policy |
| --- | --- | --- |
| Cached read model | Routes, stops, route geometry, recent searches, profile, active ride snapshot | Readable while offline, marked with freshness metadata, replaced by server data after pull. |
| Pending mutation | GPS point, driver availability intent, approved operational event, future safe status change | Stored durably, retried with an idempotency key, and shown as pending until acknowledged. |

The client keeps a per-user sync cursor. The server cursor is opaque to clients and represents a position in the server change feed. Clients must not construct or compare cursors themselves.

The first implementation should use a local SQLite database in each Expo app. AsyncStorage remains appropriate for small preferences and can be used during migration, but it is not the long-term store for relational cached data, ordered mutations, acknowledgements, and conflict records.

## Entity policy

| Entity or operation | Local cache | Queue offline | Server authority |
| --- | ---: | ---: | --- |
| Routes and stops | Yes | No | Route and stop records on the API |
| Route geometry and recent searches | Yes | No | API response and cache freshness |
| Passenger/driver profile | Yes, minimized | No | Profile API |
| Active ride snapshot | Yes, stale-labelled | No | Booking and realtime APIs |
| Driver GPS | Optional bounded history | Yes | Latest accepted location and timestamp policy |
| Driver availability/status | No or short-lived snapshot | Yes, approved intents only | Driver status service |
| Boarding scan | No | Only after explicit event design | Booking/boarding service |
| Booking creation/seat hold | Draft only | No confirmation offline | Booking transaction and seat locks |
| Booking cancellation | Display pending request only | Only through an idempotent server endpoint | Booking/refund service |
| Wallet and Paystack operations | Display last known balance only | Never | Wallet and payment services |
| Driver assignment and seat count | Display last known state only | Never | Booking transaction |
| Roles and permissions | Display cache only | Never | Auth and backend authorization |

## Mutation envelope

Every queued mutation is represented by the following logical shape. The exact transport schema is to be implemented by the backend API issue, but field meanings must remain stable.

```json
{
  "eventId": "device-generated-unique-id",
  "idempotencyKey": "client-generated-replay-safe-key",
  "entity": "driver_availability",
  "operation": "set_online",
  "payload": {},
  "clientCreatedAt": "2026-08-20T12:00:00.000Z",
  "deviceId": "installation-scoped-id",
  "schemaVersion": 1
}
```

`eventId` identifies one durable local event. `idempotencyKey` identifies the server-side effect and must remain stable across retries. The server must return the original result when an already-processed idempotency key is replayed. `clientCreatedAt` is useful for diagnostics and GPS ordering but is not trusted for authorization, payment, or booking order.

## Pull and push lifecycle

A normal synchronization cycle is:

1. Read the current authenticated user and local cursor.
2. Push eligible pending mutations in deterministic order, respecting per-entity dependencies.
3. Persist each acknowledgement before removing the local event.
4. Mark rejected or conflicted events for user/operator review rather than retrying forever.
5. Pull server changes after the push phase using the stored cursor.
6. Apply server changes transactionally to the local database.
7. Persist the next cursor only after all returned changes have been applied.
8. Expose the resulting state as `synced`, `offline`, `stale`, `pending`, or `conflict`.

A reconnect storm must be coalesced into one active sync per user/device. App launch and resume may trigger a sync, but background execution is best-effort and must not be treated as guaranteed on iOS or Android.

## Acknowledgement states

The server should return one of these outcomes for each mutation:

| State | Meaning | Client behavior |
| --- | --- | --- |
| `accepted` | The server applied the operation. | Persist acknowledgement and update local projection. |
| `duplicate` | The same idempotency key was already processed. | Treat as successful and use the original result. |
| `rejected` | Validation, authorization, or business rule failed. | Stop retrying and show the reason. |
| `conflict` | The intent is valid but cannot replace newer server state. | Preserve the event for review and display server state. |
| `retryable` | Temporary dependency or server failure. | Retry with bounded exponential backoff. |

A mutation must move to a dead-letter state after a bounded number of retry attempts. Dead-letter records must retain the original payload, error, attempt count, and timestamps for support diagnostics, subject to privacy retention rules.

## Conflict rules

The server wins for seats, booking state, payment state, wallet balances, refunds, cancellations, driver assignments, route and stop definitions, roles, and notification delivery. Clients never merge these values using last-write-wins.

For GPS, the server may accept points based on authenticated driver identity, event time, route/bus ownership, accuracy, and a maximum age. Older points must not replace newer accepted points. GPS data is operational telemetry, not a financial ledger.

For driver availability, a queued intent may be accepted only if the driver account and bus assignment are still valid. If the server has a newer status or the driver is already assigned to an incompatible state, return `conflict` and require the driver to choose the current server state.

For drafts and recent searches, the client may retain local data without synchronization. These records are not shared truth and can be replaced or discarded without a conflict.

## Local data and privacy

All local records are user-scoped and must include a schema version. Auth tokens belong in secure credential storage, not in ordinary cached records. Cached phone numbers, trip details, GPS points, and payment metadata must be minimized and assigned retention limits. Logout, account switching, and account deletion must remove or invalidate user-scoped caches and pending events.

The local database must not contain Paystack secret material. A queued payment intent may contain only a safe client reference needed to resume a server-side payment flow; it must never contain card data, secret keys, or an assertion that money was received.

## Migration and rollout

The local schema must support a fresh install and an upgrade from the current AsyncStorage GPS queue. The driver migration must import recoverable GPS points once, mark the legacy key as migrated, and remain safe if interrupted and retried.

Offline sync should be introduced behind separate passenger and driver feature flags. The initial pilot should enable read caching and driver GPS synchronization before any queued booking-adjacent operation. Rollout must support disabling new queue writes while still allowing safe reconciliation of existing events.

## Required test matrix

The implementation is not complete until tests cover fresh install, schema upgrade, device restart, airplane mode, intermittent connectivity, reconnect storms, duplicate flushes, server 401/409/429/5xx responses, token expiry, stale cursors, conflict responses, bounded queue growth, logout/account switching, concurrent last-seat booking, and Paystack operations. Payment, booking confirmation, wallet balance, and seat availability must remain server-authoritative in every offline test.
