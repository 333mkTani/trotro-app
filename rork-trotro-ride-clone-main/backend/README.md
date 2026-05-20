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

Health check: `GET /health`.

### Spatial endpoints (PostGIS)

- `GET /api/stops/nearby?lat=&lng=&radius_m=&limit=` — nearest active bus stops, ordered by distance, with `distance_m` per row.
- `GET /api/buses/nearby?lat=&lng=&radius_m=&limit=&routeId=` — live buses within a radius of a coordinate, optionally filtered by route.

Both endpoints use a `geography(Point, 4326)` column kept in sync from `lat/lng` via triggers, plus a GIST index for `ST_DWithin` and `<->` (KNN) queries. The migration lives at `database/migrations/012_postgis_spatial.sql`.

### Caching, pub/sub & rate limiting (Redis 7+)

- Read-through cache for `routes` and `stops` lists/items, and bucketed nearby queries (`CACHE_TTL_SECONDS`, default 60s). Writes invalidate the relevant keys.
- Last-known bus location cached at `buses:loc:{busId}` (30s TTL).
- Bus location updates are published to `bus:{busId}:location` for any subscriber (worker, websocket bridge, etc.).
- `/api/*` rate limiter switches to a **Redis-backed store** when `REDIS_URL` is set so limits are shared across instances.
- Set `REDIS_URL=` (empty) to disable; the cache, pub/sub, and limiter all degrade safely.

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

