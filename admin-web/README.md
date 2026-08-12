# Smart Trotro — Admin Dashboard

A React + Vite + TypeScript web app for administrators. It is a client of the
existing API (`rork-trotro-ride-clone-main/backend`) — it has no database
access, no server of its own, and ships as static files.

Everything it shows is read-only **except** route management: creating a
route, editing its fare and details, pausing/resuming it, and archiving it.

## Running it locally

```bash
npm install
```

Copy the environment template and point it at whichever API you want:

```bash
cp .env.example .env
```

`VITE_API_URL` defaults to the deployed API. For a local backend use
`http://localhost:4000/api`. Vite inlines this at **build** time, so changing
it means restarting `npm run dev` (or rebuilding).

```bash
npm run dev
```

The dev server listens on <http://localhost:5174>. Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## Signing in

Sign in with the **phone number and password of an account whose role is
`admin`**. There is no separate admin credential store — the app calls the
same `POST /api/auth/login` the mobile apps use, then rejects the session
client-side if the profile's role is not `admin`. Every endpoint it touches is
additionally guarded server-side by `requireAuth` + `requireRole('admin')`, so
a tampered client gets 403s rather than data.

The JWT is kept in `localStorage` under `trotro.admin.token`. A 401 from any
request clears it and returns you to the login screen.

## Pages

| Route | What it shows |
| --- | --- |
| `/` | Money and fleet stat cards, a gross-collections chart (7/30/90 days), bookings by status, payment states, and the latest bookings |
| `/bookings` | Every booking with filters (status, payment status, route, date range, free-text search) and a detail drawer including the full payment trace |
| `/fleet` | Every bus with its driver, route, GPS freshness, seat occupancy and open bookings |
| `/routes` | Route management — create, edit fare/details, pause/resume, archive, edit the ordered stop list; plus 30-day bookings and revenue per route |
| `/operations` | Trace lookup by record id (booking payments, scheduled occurrence, bus alert) and the API's in-process instrumentation counters |

Overview polls every 20s and Fleet every 15s; the rest refetch on window focus.

## About archiving a route

There is no hard delete. `buses.route_id` and `bookings.route_id` are foreign
keys, so removing a row would either fail or orphan historical bookings.
`DELETE /api/routes/:id` sets the route's status to `deleted`, which hides it
from the passenger and driver apps while keeping every past booking readable
and auditable. The response reports how many active buses and open bookings
were still attached, and the dashboard surfaces those counts so you know what
to reassign. Set the status filter to **Archived** to see archived routes.

Editing a fare affects **new** bookings only. Bookings already priced keep the
fare they were quoted.

## Editing the stops on a route

The **Stops** button on a route row opens an ordered list of that route's stops.
Stops can be reordered, removed, picked from the pool of existing stops, or
created outright (name, type, latitude, longitude — a database trigger derives
the PostGIS point used by the nearby-stop search).

Saving sends the whole ordered list to `PUT /api/routes/:id/stops`, which
replaces the route's stops in one transaction. `route_stops` is keyed on
`(route_id, sequence)` and unique on `(route_id, stop_id)`, so incremental
position edits would collide with one constraint or the other — replacing the
list wholesale sidesteps both, and re-saving an unchanged list is a no-op.

Order matters: the passenger app reads the list forwards for the outbound
direction and backwards for the return, so each stop is listed once, in
travel order from origin to destination.

## API endpoints it uses

Read-only, all under `/api/admin`:

- `GET /admin/dashboard/overview` — aggregate snapshot (cached 15s server-side)
- `GET /admin/dashboard/series?days=` — daily revenue and booking counts
- `GET /admin/dashboard/bookings?…` — paginated, filterable booking list
- `GET /admin/dashboard/fleet` — buses with live location freshness
- `GET /admin/dashboard/routes?status=` — routes including paused/archived
- `GET /admin/dashboard/route-performance?days=`
- `GET /admin/payments/bookings/:id/trace`
- `GET /admin/schedules/metrics`, `GET /admin/schedules/occurrences/:id`
- `GET /admin/bus-alerts/alerts/:id`

Read-only, on the public resources:

- `GET /routes/:id/stops` — the ordered stops on a route
- `GET /stops` — every active stop, the pool the stop picker draws from

Mutating, on the public routes/stops resources but admin-guarded:

- `POST /routes`, `PATCH /routes/:id`, `DELETE /routes/:id`
- `PUT /routes/:id/stops` — replace a route's ordered stop list
- `POST /stops` — create a bus stop

## Deploying

`render.yaml` at the repo root defines a `trotro-admin-web` static site
(`rootDir: admin-web`, publish `dist/`, SPA rewrite to `index.html`). Set
`VITE_API_URL` there before the first build.

The API's `CORS_ORIGIN` is currently `*`. It also accepts a comma-separated
allow-list, so once the admin site has a stable URL you can tighten it to just
that origin — the mobile apps are unaffected, since native `fetch` is not
subject to CORS.
