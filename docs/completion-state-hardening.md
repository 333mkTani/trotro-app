# Completion-state hardening

## Completion contract

A booking may transition to `completed` only from `confirmed`, and only after arrival evidence, payment, and a used boarding code have been verified. The booking row is locked with `FOR UPDATE` before authorization, validation, or mutation so competing completion requests serialize on the same record.

The database status update also requires the current status to be `confirmed`. The service-level lock and database-level guard protect against both application races and future callers that bypass the service precondition.

## Atomic finalization

Completion, schedule-occurrence finalization, seat release, and recovery-state resolution execute inside the same database transaction. `seat_released_at` is set only when the bus inventory increment succeeds. A failure rolls back the completed status, schedule state, seat inventory, and audit timestamp together.

Realtime notifications are emitted only after the transaction has completed successfully. Notification failure cannot make a committed completion appear unsuccessful or cause a second completion attempt.

## Idempotency

A repeated request for an already completed booking returns the locked completed record without updating `completed_at`, re-releasing the seat, or running the schedule transition again. For legacy completed rows that predate `seat_released_at` and still have a reserved bus seat, the guarded completion path repairs the missing release audit timestamp through the same atomic release helper.

Schedule occurrence completion is also idempotent: a departed occurrence transitions once, while an already completed occurrence is returned unchanged.

## Release gates

Staging must verify two concurrent completion requests, a completion failure rollback, unauthorized completion, unpaid completion rejection, missing-arrival rejection, unused-code rejection, duplicate completion after seat release, and legacy completed-row repair. Reconciliation must confirm that every completed booking with a bus has exactly one seat release and that no completed request changes payment or settlement ledgers.
