# Seat release lifecycle

## Invariant

A confirmed booking reserves one physical bus seat. The seat is released exactly once when the booking reaches a terminal state that ends the reservation: `cancelled`, `expired`, or `completed`. The booking’s `seat_released_at` timestamp is written in the same database transaction as the bus inventory increment.

> `seat_released_at` is null while a reservation is active and non-null only after the inventory adjustment succeeds.

## Release paths

| Path | Terminal state | Release behavior |
|---|---|---|
| Passenger or authorised operator cancellation before boarding | `cancelled` | Increment the bus seat and record `seat_released_at` atomically. |
| Confirmed no-show or expired booking | `expired` | Increment the bus seat and record `seat_released_at` atomically; financial compensation is handled separately. |
| Completed boarded ride | `completed` | Increment the bus seat and record `seat_released_at` atomically after completion checks pass. |
| Pending boarded-ride recovery | `confirmed` with recovery `pending` | Do not release the seat. Recovery review must complete or explicitly reconcile the ride first. |

The release operation uses the booking row lock, updates the bus only when the booking has not previously released its seat, and then records the timestamp only if the bus update succeeded. Repeated calls are no-ops.

## Reconciliation

Operations should investigate any terminal booking with a null `seat_released_at`, and any non-terminal booking with a non-null value. A discrepancy must be corrected with an auditable reconciliation transaction rather than by editing the timestamp or bus seat count independently.

## Release gates

Staging must verify cancellation, no-show expiry, completion, duplicate release calls, concurrent terminal transitions, rollback when the bus update fails, and migration replay. Production rollout requires a fresh-database migration check and a report comparing terminal booking counts with seat-release timestamps and bus inventory.
