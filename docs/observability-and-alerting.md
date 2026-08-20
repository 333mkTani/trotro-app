# Observability and alerting

Issue #33 adds low-cardinality operational telemetry to the backend. The API records request counts, request-duration totals, HTTP errors, dependency readiness, payment mismatches, duplicate payment callbacks, and realtime disconnects. Structured events intentionally exclude tokens, passwords, phone numbers, emails, account numbers, payment references, authorization headers, and provider response bodies.

## Metrics export

When `METRICS_TOKEN` is configured, `GET /metrics` returns Prometheus-compatible text and requires `Authorization: Bearer <METRICS_TOKEN>`. Without a token the endpoint returns 404, so an unconfigured deployment does not accidentally expose metrics. The token belongs in the deployment secret manager and must not be committed or exposed to mobile apps.

| Signal | Event or metric | Initial alert guidance |
|---|---|---|
| API errors | `trotro_http_errors_total`, `trotro_api_errors_total` | Alert on a sustained 5xx rate above 2% or a sudden 3x baseline increase. |
| Booking failures | API error route dimensions plus domain error events | Alert on repeated booking 5xx/conflict spikes and compare against booking volume. |
| Payment mismatches | `trotro_payment_mismatches_total` and `payment.mismatch` | Page on any unexpected mismatch during controlled payment tests; investigate production increases immediately. |
| Duplicate callbacks | `trotro_payment_duplicate_callbacks_total` | Track as a replay/idempotency signal; alert if duplicates rise without a corresponding provider retry incident. |
| Withdrawals | Existing transaction statuses should be queried for pending age | Alert when pending withdrawals exceed the agreed SLA; add a scheduled exporter in the monitoring platform. |
| Worker health | `/ready` dependency gauges and worker logs | Alert when readiness is non-200 or the schedule worker has no successful cycle within its interval. |
| Redis health | `trotro_dependency_ready{dependency=redis}` | Alert on any sustained zero while `REQUIRE_REDIS=true`. |
| Realtime | `trotro_realtime_connections_total`, `trotro_realtime_disconnects_total` | Alert on disconnect-to-connect ratio spikes or repeated transport errors. |

The in-process counters reset on restart. Production monitoring must scrape `/metrics` at a stable interval and use deployment-aware recording rules. Render logs remain useful for structured event search, while a retained metrics backend is required for historical rates and alerting.

## Validation

Run backend tests and then verify the endpoint with a staging token. Do not include the token in logs or issue comments. Confirm that `/health` remains public, `/ready` reports database and Redis state, `/metrics` returns 404 when disabled, 401 for an incorrect token, and metrics text for the correct token.

## References

[1]: https://prometheus.io/docs/concepts/metric_types/ "Prometheus metric types"

[2]: https://prometheus.io/docs/practices/naming/ "Prometheus metric and label naming"
