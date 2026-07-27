# Trotro — Driver App

React Native (Expo Router) app for Trotro drivers. Lets a driver go online, see and accept ride requests, run turn-by-turn navigation, verify passenger boarding codes, broadcast live GPS location, manage their weekly schedule/route, and manage their wallet — including cashing out earnings to a bank account or mobile money wallet.

Talks to the shared [backend](../../backend) over REST + Socket.IO. See the [monorepo root README](../../README.md) for how this app fits alongside the backend and the [passenger app](../../rork-trotro-ride-clone-main/expo).

## Stack

- **Expo Router** (file-based routing) + **React Native 0.81** + **TypeScript**
- **zustand** for app state (`store/authStore.ts`, `bookingStore.ts`, `driverStore.ts`)
- **@tanstack/react-query** for server state
- **socket.io-client** for real-time ride requests and location streaming (`services/socket.ts`)
- **axios** for REST calls (`services/api.ts`, `services/driverApi.ts`)
- **expo-location** for GPS (`services/gpsService.ts`)
- **expo-notifications** for ride-request/payout push notifications
- **Paystack** for wallet top-ups and payouts (`services/paystack.ts`)

## Screens (`app/`)

- `register.tsx`, `verify.tsx` — driver onboarding & document verification
- `(tabs)/dashboard` — online/offline toggle, today's stats
- `(tabs)/requests`, `navigate.tsx` — incoming ride requests, turn-by-turn navigation
- `demand-map.tsx` — heatmap of passenger demand
- `(tabs)/schedule`, `change-route.tsx` — weekly schedule and assigned route
- `(tabs)/wallet`, `fund-wallet.tsx`, `withdraw.tsx` — balance, top-up, cash out
- `pro-subscription.tsx` — driver subscription tier
- `(tabs)/settings`, `edit-profile.tsx`, `change-password.tsx`, `notification-settings.tsx` — account

## Wallet & payouts

`services/driverApi.ts` wraps the backend's `/api/wallet` endpoints:

- **Top up** (`fund-wallet.tsx`) — same Paystack Checkout + server-side verify flow as the passenger app.
- **Withdraw** (`withdraw.tsx`) — driver picks mobile money (MTN/Vodafone/AirtelTigo) or a bank from the live list at `GET /api/wallet/banks`, then `POST /api/wallet/withdraw`. The backend debits the wallet immediately and pays out via Paystack Transfers; if the transfer is rejected or the provider can't be resolved, the backend refunds the wallet automatically — the UI should treat a `failed` transaction as "money is back in your wallet," not as a silent loss. See the backend README's [wallet & Paystack](../../backend/README.md#wallet--paystack-top-ups-and-payouts) section for the full debit/refund/webhook flow.
- Transaction history and status (`pending` / `completed` / `failed`) come from `GET /api/wallet/transactions`.

## Backend integration

- REST base URL is hardcoded in `services/api.ts` (`API_BASE_URL`) — currently `https://trotro-api.onrender.com`. Point this at a local backend (`http://localhost:4000`, or your machine's LAN IP for a physical device) when developing against a local API.
- `services/socket.ts` connects to the same host; drivers emit `bus:location` while online so passengers tracking their route see live movement, and receive ride-request events in real time — see the backend README's [real-time bus tracking](../../backend/README.md#real-time-bus-tracking-socketio) section.
- `services/offlineQueue.ts` queues actions (e.g. location pings) taken while offline and flushes them once connectivity returns.

## Setup

```bash
cd rork-trotro-driver-app-main/expo
npm install
npm run start-web   # web preview, or `npm run start` for iOS/Android via Expo Go
```

Requires the backend running and reachable at whatever `API_BASE_URL` you set in `services/api.ts`.

## Testing

```bash
npm test
```

Runs Jest (`jest-expo` preset) against `**/__tests__/**/*.test.ts`. Coverage currently targets pure utility logic (`utils/helpers.ts` — time/distance formatting, ETA countdowns, seat-availability color coding) rather than screens/components, since those would need heavy native-module mocking (maps, location, sockets) for comparatively low value.

```bash
npx tsc --noEmit   # type-check
npm run lint       # expo lint
```
