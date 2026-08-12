# Trotro

A nationwide ride-hailing app for Ghana's trotro (shared minibus) system: passengers find nearby stops and routes, track approaching buses live, book seats, and pay; drivers go online, accept requests, navigate, verify boarding codes, and manage their earnings — all backed by a shared Express/PostgreSQL/Redis/Socket.IO API.

## Sub-projects

This is a single git repository containing four independently-versioned Node projects (no npm workspaces — `cd` into each and `npm install` separately):

| Project | Path | What it is |
| --- | --- | --- |
| **Backend API** | [`rork-trotro-ride-clone-main/backend`](rork-trotro-ride-clone-main/backend) | Express + PostgreSQL (PostGIS) + Redis + Socket.IO REST/realtime API used by both apps |
| **Passenger app** | [`rork-trotro-ride-clone-main/expo`](rork-trotro-ride-clone-main/expo) | Expo Router / React Native app for riders |
| **Driver app** | [`rork-trotro-driver-app-main/expo`](rork-trotro-driver-app-main/expo) | Expo Router / React Native app for drivers |
| **Admin dashboard** | [`admin-web`](admin-web) | React + Vite + TypeScript web app for administrators — operational monitoring plus route management |

Each has its own README with setup, architecture, and testing details specific to that project — start there for anything project-specific. This file covers how the pieces fit together.

## Architecture

```
                    ┌─────────────────────┐
   passenger app ──▶│                      │
   (Expo/RN)         │   backend (Express)  │──▶ PostgreSQL + PostGIS
                    │   REST + Socket.IO   │──▶ Redis (cache, pub/sub,
   driver app    ──▶│                      │        rate limiting)
   (Expo/RN)         │                      │
                    │                      │
   admin-web     ──▶│                      │
   (React/Vite)      └─────────┬───────────┘
                                │
                                ▼
                            Paystack
                (checkout for top-ups, Transfers for payouts,
                       webhook for async confirmation)
```

- Both apps talk to the backend over REST (`/api/...`) and Socket.IO (live bus location, ride requests) — see each app's README for exactly which endpoints/events it uses.
- Wallets (top-up and withdrawal/payout) are shared logic on the backend, driven by Paystack; see the backend README's [wallet & Paystack](rork-trotro-ride-clone-main/backend/README.md#wallet--paystack-top-ups-and-payouts) section.
- The admin dashboard is a pure API client — no database access of its own. It authenticates with the same `POST /api/auth/login` the apps use and every endpoint it calls is guarded by `requireAuth` + `requireRole('admin')`.
- Production is deployed on Render (`render.yaml` at repo root): `trotro-api` (Node web service), `trotro-schedule-worker` (background worker), `trotro-admin-web` (static site) and `trotro-redis` (Redis). PostgreSQL is hosted separately (Supabase-compatible connection string via `DATABASE_URL`).

## Local development

You'll run three processes: the backend API, and whichever app(s) you're working on.

```bash
# 1. Backend
cd rork-trotro-ride-clone-main/backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, PAYSTACK_SECRET_KEY, etc.
npm install
npm run migrate        # apply schema.sql / migrations to your database
npm run dev             # http://localhost:4000

# 2. Passenger app (separate terminal)
cd rork-trotro-ride-clone-main/expo
npm install
npm run start-web       # or `npm run start` for iOS/Android via Expo Go

# 3. Driver app (separate terminal)
cd rork-trotro-driver-app-main/expo
npm install
npm run start-web

# 4. Admin dashboard (separate terminal, optional)
cd admin-web
cp .env.example .env    # set VITE_API_URL=http://localhost:4000/api
npm install
npm run dev             # http://localhost:5174
```

Both apps default `API_BASE_URL` (in each app's `services/api.ts`) to the deployed Render backend — point it at `http://localhost:4000` (or your machine's LAN IP, for testing on a physical device) to develop against a local API.

## Testing

Each sub-project has its own Jest suite — see [CHANGELOG.md](CHANGELOG.md) for what's covered and each sub-project's README for how to run it. Quick reference:

```bash
(cd rork-trotro-ride-clone-main/backend && npm test)
(cd rork-trotro-ride-clone-main/expo && npm test)
(cd rork-trotro-driver-app-main/expo && npm test)
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
