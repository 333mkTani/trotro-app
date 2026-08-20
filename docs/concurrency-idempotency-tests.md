# Concurrency and idempotency verification

Issue #28 adds `backend/scripts/verify-concurrency.mjs`, exposed as `npm run verify:concurrency`. The verifier is intended for an isolated staging database and requires `CONCURRENCY_ENV=staging` plus `CONCURRENCY_CONFIRM=I_UNDERSTAND_STAGING_DB`. It creates a uniquely named one-seat scratch bus, runs two concurrent seat reservations through separate PostgreSQL sessions, verifies exactly one succeeds, and deletes the scratch row afterward.

It also uses the latest booking fixture to run two concurrent inserts with the same payment idempotency key. The unique ledger constraint must allow exactly one insert and reject the other with PostgreSQL unique-violation code `23505`. The temporary payment row is deleted after the check. No seeded bus or user is modified by the verifier.

```bash
cd rork-trotro-ride-clone-main/backend
DATABASE_URL=postgresql://... \
PGSSL=true \
CONCURRENCY_ENV=staging \
CONCURRENCY_CONFIRM=I_UNDERSTAND_STAGING_DB \
npm run verify:concurrency
```

| Scenario | Automated check | Expected result |
|---|---|---|
| Last-seat race | Two sessions execute the guarded `UPDATE ... WHERE seats_available > 0 RETURNING` concurrently. | Exactly one reservation succeeds and the other returns no row. |
| Duplicate payment idempotency | Two sessions insert the same payment `idempotency_key`. | Exactly one ledger row is created and the other insert receives a unique violation. |
| Repeated cancellation | Existing service tests cover state guards and seat release; run against staging after a real booking fixture is available. | First cancellation succeeds; subsequent cancellation is rejected without a second seat release/refund. |
| Duplicate payment callback | Existing service tests cover already-succeeded handling; replay a signed staging webhook twice using issue #27’s runner. | The first callback applies the transition; the replay is acknowledged without a second ledger/seat/code transition. |
| Socket reconnect | Connect, disconnect, reconnect, and resubscribe using a staging client with the same bearer token. | Authentication is re-established and subscriptions are restored without duplicate side effects. |
| Worker restart | Run two worker instances or restart one during a cycle. | Advisory lock allows one cycle at a time; a crashed session releases the lock and the next worker proceeds. |

The verifier is not a substitute for real multi-process staging tests. Run the socket and worker scenarios with the deployed API/worker and Redis enabled, record deployment IDs and timestamps, and attach sanitized logs to issue #28. Never point the verifier at production or use live payment keys.
