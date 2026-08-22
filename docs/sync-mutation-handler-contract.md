# Sync mutation handler contract

Every mutation executed by the sync reserve–apply–mark pipeline must be registered through the client-aware handler registry in `sync.service.js`.

A handler receives `(user, payload, client)`, where `client` is the transaction client created by `withTransaction`. All database reads and writes belonging to the mutation must use that client. A handler must return a result, a change-feed entry, and optional post-commit side effects. Realtime, push, and other external effects must not run before the transaction commits.

> A mutation is not transaction-safe merely because its dispatcher accepts `client`; every model and service call reachable from the handler must receive and use the same client.

## Registration rules

Future mutation types must be added with `registerMutationHandler(entity, operation, handler)`. The registry wrapper rejects execution without a transaction client, and unsupported entity/operation combinations are rejected before any database work occurs. This prevents an unreviewed handler from silently using the shared pool inside the reserve–apply–mark transaction.

## Required review checklist

| Check | Requirement |
|---|---|
| Handler signature | Accepts `user`, `payload`, and `client`. |
| Database access | Every query path uses the supplied client, including nested model/service calls. |
| Idempotency | Repeated event and idempotency keys cannot apply the business mutation twice. |
| Change feed | Exactly one change is appended in the same transaction as the business mutation. |
| External effects | Notifications and realtime emissions run only after commit. |
| Failure behavior | Database or transport failures roll back and remain retryable. |
| Tests | Includes success, rollback, duplicate, concurrent, and unsupported-mutation coverage. |

The current registered mutations are driver location updates, driver availability changes, and driver driving-status changes. New mutation types must satisfy this contract before being enabled in the client protocol.
