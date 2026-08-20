# Trotro Backend

REST API for the Trotro app. Built with **Node.js + Express + PostgreSQL** (Supabase-compatible).

## Stack

- Node.js + Express 4
- PostgreSQL via `pg`, with **PostGIS** for spatial queries (works against any Postgres, including Supabase)
- **Redis 7+** via `ioredis` for response caching, distributed rate-limiting, and bus-location pub/sub
- JWT authentication (`jsonwebtoken`)
- Validation with `zod`
- Security: `helmet`, `cors`, `express-rate-limit` (Redis-backed when configured)
- Logging: `morgan`

## Architecture

```
backend/
└── src/
    ├── config/        # env + db pool
    ├── controllers/   # HTTP handlers (req/res only)
    ├── services/      # business logic (pure, testable)
    ├── models/        # SQL queries / data access
    ├── routes/        # Express routers
    ├── middleware/    # auth, error, validate, rateLimit
    ├── validators/    # zod schemas per resource
    ├── utils/         # helpers (codes, errors, async)
    ├── app.js         # Express app composition
    └── server.js      # entry point
```

## Setup

```bash
cd backend
cp .env.example .env       # then edit DATABASE_URL + JWT_SECRET
bun install                # or npm install
bun run dev                # or npm run dev
```

The schema lives at `expo/supabase/schema.sql`. Apply it once to your database (Supabase SQL editor or `psql $DATABASE_URL -f expo/supabase/schema.sql`). The backend assumes the tables already exist — implementation room is left in the model layer to swap raw SQL for ORM if desired.

## Endpoints (high level)

| Resource | Base path |
| --- | --- |
| Auth | `/api/auth` |
| Profiles | `/api/profiles` |
| Routes | `/api/routes` |
| Bus Stops | `/api/stops` |
| Buses | `/api/buses` |
| Drivers | `/api/drivers` |
| Bookings | `/api/bookings` |
| Verification codes | `/api/codes` |
| Bus Alerts | `/api/alerts` |
| Wallet | `/api/wallet` |
| Driver Ratings | `/api/ratings` |
| Webhooks | `/api/webhooks` |

Health check: `GET /health`.

### Spatial endpoints (PostGIS)

- `GET /api/stops/nearby?lat=&lng=&radius_m=&limit=` — nearest active bus stops, ordered by distance, with `distance_m` per row.
- `GET /api/buses/nearby?lat=&lng=&radius_m=&limit=&routeId=` — live buses within a radius of a coordinate, optionally filtered by route.

Both endpoints use a `geography(Point, 4326)` column kept in sync from `lat/lng` via triggers, plus a GIST index for `ST_DWithin` and `<->` (KNN) queries. The migration lives at `database/migrations/012_postgis_spatial.sql`.

### Route stops

- `GET /api/routes/:id/stops` — the route's stops in travel order (`sequence` ascending). Public.
- `PUT /api/routes/:id/stops` — replace the whole list: `{ "stopIds": ["uuid", …] }`, in order. Admin only.

The replacement is deliberate rather than incremental. `route_stops` is keyed on `(route_id, sequence)` and unique on `(route_id, stop_id)`, so shifting positions row by row collides with one constraint or the other; deleting the route's rows and re-inserting the full ordered list inside a transaction avoids both and makes a repeated save a no-op. Unknown or inactive stop ids are rejected with a 400 before the write, so the foreign key never fires.

Clients read the list forwards for the outbound direction and reversed for the return (`stops_sequence` / `reverse_stops_sequence` on `GET /api/routes`), so each stop appears once, ordered origin → destination.

### Caching, pub/sub & rate limiting (Redis 7+)

- Read-through cache for `routes` and `stops` lists/items, and bucketed nearby queries (`CACHE_TTL_SECONDS`, default 60s). Writes invalidate the relevant keys.
- Last-known bus location cached at `buses:loc:{busId}` (30s TTL).
- Bus location updates are published to `bus:{busId}:location` for any subscriber (worker, websocket bridge, etc.).
- `/api/*` rate limiter switches to a **Redis-backed store** when `REDIS_URL` is set so limits are shared across instances.
- Set `REDIS_URL=` (empty) to disable; the cache, pub/sub, and limiter all degrade safely.

**`TRUST_PROXY` matters for the limiter.** It is the number of reverse proxies
in front of the API, and it decides what Express reports as `req.ip` — the key
the limiter counts against. Left too low, every request appears to come from
the proxy and all devices share a single 120-req/minute bucket, so a handful of
active users can rate-limit the entire platform. Set too high, a client can
forge `X-Forwarded-For` and evade the limit. Use `0` running directly, `1`
behind Render or a single nginx, `2` behind Render + Cloudflare. `GET /health`
returns the IP the server resolved for you — if it is not your public address,
the hop count is wrong. Both Expo apps back off on a `429` and retry safe reads
after `Retry-After`, but never replay a booking, payment or cancellation.

### Wallet & Paystack (top-ups and payouts)

Every passenger and driver has a wallet (`GET /api/wallet`, `GET /api/wallet/transactions`). Money moves through Paystack in both directions:

- **Top-up** (`POST /api/wallet/topup/initialize` → `POST /api/wallet/topup/verify`) — the client opens a Paystack Checkout/inline transaction, then the backend verifies it server-side via `paystack.service.js#verifyTransaction` before crediting the wallet. Never trust a client-reported "payment succeeded" — the wallet is only credited once Paystack confirms the transaction status directly.
- **Withdrawal / payout** (`POST /api/wallet/withdraw`, banks list at `GET /api/wallet/banks`) — `wallet.service.js#requestWithdrawal` debits the wallet immediately, then calls Paystack Transfers (`createTransferRecipient` + `initiateTransfer`) to pay out to a bank account or mobile money wallet. Three outcomes are handled:
  - Paystack confirms instantly → transaction marked `completed`.
  - Paystack accepts but hasn't confirmed (e.g. OTP-gated transfers) → transaction stays `pending`; it is finalized later by the webhook.
  - Paystack rejects the transfer, or the mobile money provider can't be resolved to a Paystack bank code → the wallet is refunded and the transaction is marked `failed`.
- **Webhook** (`POST /api/webhooks/paystack`) — `webhook.controller.js` verifies the `x-paystack-signature` header (HMAC-SHA512 over the raw request body, see `paystack.service.js#verifyWebhookSignature`) before processing anything. `transfer.success` / `transfer.failed` / `transfer.reversed` events finalize any `pending` withdrawal (row-locked, idempotent — a replayed webhook is a no-op once the transaction is no longer `pending`). The raw body needed for signature verification is captured in `app.js`'s `express.json()` `verify` hook (`req.rawBody`), since JSON parsing would otherwise discard it.

Set `PAYSTACK_SECRET_KEY` in `.env` (server-side only — never expose it to a client bundle) and register the webhook URL (`https://<your-api-host>/api/webhooks/paystack`) in the Paystack dashboard.

### Phone verification at registration (Firebase Phone Auth)

Registration is verified so the account is only ever created once the phone number is proven to be controlled by the caller. Unlike a server-driven OTP flow, the SMS send + code check happens entirely on-device via the `@react-native-firebase/auth` SDK talking directly to Firebase — the backend never sends or stores a code. It only ever sees the resulting signed ID token:

- `POST /api/auth/register-verified` — body: `{ idToken, fullName, email?, password, role?, busRegistration?, routeId?, totalSeats? }`. The `idToken` comes from the client completing Firebase Phone Auth (`signInWithPhoneNumber` → `confirm(code)` → `getIdToken()`). The backend verifies it via `firebase-admin` (`admin.auth().verifyIdToken`, see `config/firebase.js#getAdmin`), extracts the verified `phone_number` claim, rejects if that phone is already registered, then creates the account via `auth.service.js#createAccount` with `is_verified = true` and returns `{ user, token }` — the same shape `POST /api/auth/register` returns. An invalid or expired token yields `401`.

Requires `FIREBASE_SERVICE_ACCOUNT` (service account JSON, single-line string) in `.env` — the same credential already used for FCM push notifications in `push.service.js`. The legacy `POST /api/auth/register` endpoint still exists (accounts created that way have `is_verified = false`) but neither app's frontend calls it anymore.

### Real-time bus tracking (Socket.IO)

`src/realtime/io.js` attaches a Socket.IO server to the same `http.Server` as Express (see `server.js`), authenticated via JWT at handshake (`socket.handshake.auth.token`, checked against `JWT_SECRET` and, if configured, `SUPABASE_JWT_SECRET`).

Room conventions:

| Room | Who's in it | Purpose |
| --- | --- | --- |
| `user:<userId>` | that user's own sockets | booking updates, alerts |
| `driver:<driverId>` | that driver's own sockets | assignments, payout status |
| `bus:<busId>` | passengers tracking a bus | live location for one bus |
| `route:<routeId>` | passengers watching a route | live location for any bus on that route |

Drivers emit `bus:location` (`{ busId, routeId?, lat, lng, heading?, speed?, ts? }`); the server re-broadcasts it to the `bus:` and `route:` rooms and publishes it on the `bus:location` Redis channel so other API instances stay in sync. When `REDIS_URL` is set, the Socket.IO Redis adapter fans events out across multiple Node instances behind Nginx; without it, the server runs in single-instance mode. Server-side code elsewhere in the app can push events via `emitToUser` / `emitToDriver` / `emitToBus` / `emitToRoute` exported from `realtime/io.js`.

## Offline-first synchronization

The proposed controlled offline-first contract is documented in [`docs/offline-sync-protocol.md`](docs/offline-sync-protocol.md). It defines cacheable data, safe queued intents, server-authoritative booking and payment boundaries, idempotency requirements, conflict states, retention, migration, and the required test matrix. Implementation is tracked in [issue #14](https://github.com/333mkTani/trotro-app/issues/14) and its linked child issues.

## Testing

```bash
npm test
```

Runs the Jest suite (`jest.config.js`, `testEnvironment: 'node'`) against `src/**/__tests__/**/*.test.js`. Coverage focuses on pure/service logic — utils, validators, `paystack.service.js`, and `wallet.service.js` (mocking the DB and the Paystack HTTP calls) — rather than hitting a live database.

## Nginx (edge / API gateway)

Production traffic is fronted by **Nginx** (`backend/nginx/nginx.conf`), wired up
in `docker-compose.yml` as the `nginx` service. The Node API is no longer
published directly — only Nginx is exposed on `${NGINX_PORT:-8080}`.

What it does:

- TLS-ready reverse proxy in front of the Node API (`upstream trotro_api`).
- Edge **rate limiting** (`20 r/s`, burst 40) on top of the app limiter.
- **gzip** compression for JSON / text responses.
- Short-lived **response cache** (30s) for `GET /api/routes` and `GET /api/stops`,
  bypassed automatically when an `Authorization` header is present.
- Hardened **security headers** (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `X-XSS-Protection`).
- Forwards `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto` so the API
  sees real client IPs.
- Cheap edge health probe at `GET /nginx-health` (does not hit Node).

Run the full stack:

```bash
docker compose up -d db api nginx
# API now reachable at http://localhost:8080/api/...
```

