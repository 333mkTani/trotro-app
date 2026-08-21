# Boarded-ride recovery lifecycle

## Purpose

A ride that has been boarded must not be silently expired, cancelled, or have its seat returned merely because the driver, passenger, or API process stopped reporting progress. Once `boarded_at` exists, the booking has crossed the no-show boundary and requires completion or explicit operational review.

## States

| State | Meaning | Seat behavior | Payment behavior |
|---|---|---|---|
| `none` | Normal boarded ride lifecycle | The seat remains occupied until completion | Existing deposit, balance, and payment rules apply |
| `pending` | The boarded ride exceeded `BOARDED_RIDE_RECOVERY_HOURS` and needs review | No automatic release | No automatic refund, forfeiture, or settlement |
| `resolved` | A pending ride was completed successfully | Completion releases the seat once | Completion preserves the recorded payment state |
| `deferred` | Reserved for a future explicit administrative deferral action | No automatic release | No automatic financial mutation |

## Automated recovery

The booking sweeper calls `recoverStaleBoarded()` after the existing stale-confirmed-booking sweep. The recovery job locks eligible rows with `FOR UPDATE SKIP LOCKED`, marks them `pending`, records a reason and timestamp, and leaves booking status, seat inventory, payment state, and boarding evidence unchanged.

The default recovery window is six hours and is configured through `BOARDED_RIDE_RECOVERY_HOURS`. Production changes require operations and finance approval because the value changes how quickly stalled rides enter manual review.

## Completion

Completion now locks and reloads the booking inside one transaction. It verifies the current status, arrival evidence, payment, and used boarding code before changing the booking to `completed`. The same transaction releases the held seat and changes a pending recovery state to `resolved`. Repeated completion requests return the existing completed record and cannot release the seat twice.

Realtime notifications must be treated as post-commit effects. A notification failure must not roll back a valid completion or make the client believe that a committed completion failed.

## Operator procedure

When a ride is `pending`, support or operations should verify the driver location history, destination-arrival evidence, used boarding code, payment ledger, and passenger/driver reports. The operator should then either complete the ride through the normal guarded completion path or document a separately approved financial and lifecycle adjustment. Operators must not release the seat or mark a refund solely because the recovery flag exists.

## Acceptance criteria

A release is not ready until tests prove that stale boarded rides are flagged without seat release, two recovery workers cannot process the same row, completion is serialized by a booking row lock, completion resolves recovery metadata, and a failed completion transaction leaves booking, seat, and payment state unchanged.
