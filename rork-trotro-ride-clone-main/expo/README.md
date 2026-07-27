# Trotro — Passenger App

React Native (Expo Router) app for passengers using the Trotro ride app across Ghana. Lets a rider find nearby bus stops and routes, see live-tracked buses approaching, book a seat, pay a driver or top up their wallet, and set alerts for buses on routes they care about.

Talks to the shared [backend](../../backend) over REST + Socket.IO. See the [monorepo root README](../../README.md) for how this app fits alongside the backend and the [driver app](../../rork-trotro-driver-app-main/expo).

## Stack

- **Expo Router** (file-based routing) + **React Native 0.81** + **TypeScript**
- **@tanstack/react-query** for server state, plain React Context (`contexts/`) for auth/booking/wallet/theme/location state
- **@maplibre/maplibre-react-native** for the live map (pickup, destination, approaching buses)
- **socket.io-client** for real-time bus location (`services/socket.ts`)
- **axios** for REST calls (`services/api.ts`)
- **expo-notifications** for bus-alert push notifications
- **Paystack** in-app checkout for wallet top-ups (`services/paystack.ts`)

## Screens (`app/`)

- `login.tsx`, `register.tsx`, `verification.tsx` — auth
- `(tabs)/(home)` — home/map, `find-route.tsx`, `pick-destination-map.tsx`, `book-bus.tsx`
- `tracking.tsx`, `navigate-to-pickup.tsx`, `ride-notification.tsx` — live tracking of a booked bus
- `(tabs)/rides` — ride history
- `(tabs)/wallet`, `wallet-topup.tsx`, `pay-driver.tsx` — wallet balance, top-up, paying a driver
- `(tabs)/schedule` — upcoming scheduled rides
- `set-bus-alert.tsx`, `my-alerts.tsx`, `alert-buses.tsx` — notify me when a bus is near a stop
- `rate-driver.tsx` — post-ride rating
- `(tabs)/settings`, `edit-profile.tsx`, `change-password.tsx` — account

## Backend integration

- REST base URL is hardcoded in `services/api.ts` (`API_BASE_URL`) — currently `https://trotro-api.onrender.com`. Point this at a local backend (`http://localhost:4000`, or your machine's LAN IP for a physical device) when developing against a local API.
- `services/socket.ts` connects to the same host for real-time bus locations, joining `bus:<id>` / `route:<id>` rooms as the rider tracks a ride — see the backend README's [real-time bus tracking](../../backend/README.md#real-time-bus-tracking-socketio) section for the room/event conventions.
- Auth tokens issued by the backend (`/api/auth`) are attached to both the REST client and the socket handshake.

## Setup

```bash
cd rork-trotro-ride-clone-main/expo
npm install
npm run start-web   # web preview, or `npm run start` for iOS/Android via Expo Go
```

Requires the backend running and reachable at whatever `API_BASE_URL` you set in `services/api.ts`.

## Testing

```bash
npm test
```

Runs Jest (`jest-expo` preset) against `**/__tests__/**/*.test.ts`. Coverage currently targets pure utility logic (`utils/routeFinder.ts` — nearby-stop search, route recommendations, stop search) rather than screens/components, since those would need heavy native-module mocking (maps, location, sockets) for comparatively low value.

```bash
npx tsc --noEmit   # type-check
npm run lint       # expo lint
```
