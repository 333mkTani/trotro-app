# Live staging acceptance tests

Issue #27 adds `backend/scripts/acceptance-live.mjs`, exposed as `npm run acceptance:live`. The runner exercises the deployed staging API rather than mocking its application services. It creates a uniquely named passenger account, verifies login and `/auth/me`, checks wallet initialization, discovers an active route with at least two stops and a usable bus, creates and reads a cash booking, and cancels the booking.

The runner is intentionally guarded against accidental production use. It requires an HTTPS staging URL, `ACCEPTANCE_ENV=staging`, and `ACCEPTANCE_CONFIRM=I_UNDERSTAND_STAGING_ONLY`. It refuses the production Render API hostname. Payment scenarios require `ACCEPTANCE_RUN_PAYMENTS=true` or `ACCEPTANCE_REPLAY_WEBHOOK=true` and a Paystack `sk_test_` key. The report contains statuses and non-sensitive metadata only; generated passwords, tokens, secret values, and payment payloads are never printed.

## Basic staging run

```bash
cd rork-trotro-ride-clone-main/backend
ACCEPTANCE_BASE_URL=https://trotro-staging-api.onrender.com \
ACCEPTANCE_ENV=staging \
ACCEPTANCE_CONFIRM=I_UNDERSTAND_STAGING_ONLY \
npm run acceptance:live
```

The command writes `acceptance-report.json` in the backend working directory. Preserve that report with the staging deployment identifier, API logs, database migration ledger, and the operator’s timestamp.

## Payment initialization run

Payment initialization is opt-in because it creates Paystack test-mode checkout records and may create provisional seat holds. It does not automatically complete a checkout or move money. Use a disposable staging passenger and an approved Paystack test key:

```bash
ACCEPTANCE_BASE_URL=https://trotro-staging-api.onrender.com \
ACCEPTANCE_ENV=staging \
ACCEPTANCE_CONFIRM=I_UNDERSTAND_STAGING_ONLY \
ACCEPTANCE_RUN_PAYMENTS=true \
PAYSTACK_SECRET_KEY=sk_test_... \
npm run acceptance:live
```

The runner initializes a deposit and wallet top-up, then marks provider verification and refunds as manual follow-up steps because they require an approved Paystack test checkout and a known staging fixture. Do not use a live key.

## Signed webhook replay

Webhook replay requires an approved staging JSON fixture and the corresponding test secret. The runner signs the exact fixture bytes with HMAC-SHA512 and posts the result to `/api/webhooks/paystack`.

```bash
ACCEPTANCE_BASE_URL=https://trotro-staging-api.onrender.com \
ACCEPTANCE_ENV=staging \
ACCEPTANCE_CONFIRM=I_UNDERSTAND_STAGING_ONLY \
ACCEPTANCE_REPLAY_WEBHOOK=true \
ACCEPTANCE_WEBHOOK_FIXTURE=/secure/path/paystack-test-event.json \
PAYSTACK_SECRET_KEY=sk_test_... \
npm run acceptance:live
```

The fixture must contain only synthetic staging identifiers. Do not copy a production webhook body, customer details, or live provider reference into the repository. The expected evidence is a 200 response with `{ "received": true }`, one corresponding durable state transition, and an idempotent result when the same signed event is replayed again.

## Acceptance matrix

| Scenario | Runner coverage | Additional staging evidence |
|---|---|---|
| Passenger registration and login | Automated | Confirm account and profile rows exist without exposing credentials. |
| Authenticated profile access | Automated | Confirm bearer token is accepted and belongs to the created user. |
| Route/stop/bus discovery | Automated | Record selected route, stop count, and bus fixture identifiers in restricted test notes. |
| Cash booking and cancellation | Automated | Confirm seat availability and booking status returned to the expected values. |
| Deposit initialization | Opt-in automated | Complete an approved Paystack test checkout manually and run verification. |
| Wallet top-up | Opt-in automated initialization | Complete a test checkout, verify balance and one ledger row. |
| Boarding verification | Manual follow-up | Driver confirms booking, passenger retrieves code, driver redeems code, and passenger completes ride. |
| Refund/cancellation | Manual follow-up | Verify provider refund state, internal ledger, booking state, and replay behavior. |
| Paystack webhook replay | Opt-in signed fixture | Replay the identical event twice and confirm the second run is idempotent. |
| Withdrawals | Manual follow-up | Use a synthetic staging bank account and verify pending/approved/rejected state transitions. |

The live acceptance runner cannot prove concurrency, worker restart, or physical-device behavior. Those remain separate acceptance areas covered by issues #28 and #30. Before closing issue #27, attach the sanitized report, staging deployment identifier, provider test references, webhook replay evidence, and manual payment/refund evidence to the GitHub issue.
