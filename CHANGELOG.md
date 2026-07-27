# Changelog

All notable changes to the Trotro monorepo (backend, passenger app, driver app). Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are grouped by day since no version tags exist yet.

## [Unreleased]

Currently uncommitted in the working tree:

- **Wallet payouts**: `POST /api/wallet/withdraw` pays drivers/passengers out via Paystack Transfers (mobile money or bank), with live bank-code resolution (`GET /api/wallet/banks`), HMAC-verified webhook confirmation (`POST /api/webhooks/paystack`), and automatic wallet refund if a transfer fails or the provider can't be resolved. Wired end-to-end through both apps' wallet/withdraw screens.
- **Real-time booking notifications**: drivers now receive `booking:new` / `booking:updated` over Socket.IO the moment a passenger books or a booking changes state (`useDriverSocket.ts`, driver app's `services/socket.ts`), in addition to the existing push notification.
- **Test suites**: Jest added to the backend (unit tests for utils, validators, `paystack.service.js`, `wallet.service.js`) and to both Expo apps (`jest-expo`, targeting pure utility logic in `utils/routeFinder.ts` and `utils/helpers.ts`).
- **Documentation**: this changelog, a root README describing how the three sub-projects fit together, and rewritten backend/passenger/driver READMEs (previously generic Expo/Rork boilerplate).

## 2026-07-27

- Wire up real-time bus tracking via Socket.IO and finish the migration from mock data to the live API.

## 2026-06-04

- Fix "Insufficient role" error when a passenger completes or pays for a ride.
- Render active-bus markers above stop markers on the map and fix marker clipping.
- Fix a type error on the My Rides screen referencing an undefined mock constant.
- Add `expo-dev-client` for development builds.
- Fix a blank MapLibre map by using the `mapStyle` prop instead of `styleURL`.

## 2026-06-03

- Replace `react-native-maps` with MapLibre (OpenFreeMap tiles, no API key) in both apps.
- Upgrade `zod` to v4 and align Expo packages to SDK 54 in both apps.
- Fix EAS builds: force the npm package manager, remove stray `bun.lock` files, and output an APK for direct installation.

## 2026-06-02

- Switch the EAS package manager from Bun to npm.
- Remove `@react-native-firebase` in favor of `expo-notifications`' native FCM token API.

## 2026-06-01

- Integrate push notifications end-to-end via Firebase FCM across both apps (including `google-services.json` and EAS build configs).
- Add live bus tracking after booking, with speech-bubble bus/stop markers on the map.
- Add place search (any landmark or address) to Find Route.
- Auto-confirm bookings and generate a boarding verification code on creation.
- Add route search and GPS-based city filtering to driver registration and route lookup.
- Fix booking-confirmation screen scrolling and route-card layout overflow on narrow devices.

## 2026-05-25

- Fix the route finder to use real bus data and include `stops_sequence` from the API.

## 2026-05-23

- Fix post-registration navigation to route to the dashboard.
- Fix a seat-update bug caused by referencing a nonexistent `updated_at` column.

## 2026-05-21

- Add Accra trotro seed data: 23 stops, 8 routes, 16 buses.
- Point both apps at the deployed Render backend.
- Fix registration to run all inserts on the same transaction client and create the `users` row before the `profiles` insert.
- Fix the driver availability toggle to use a `paused` status and include paused buses in `getMyBus`.
- Collect bus details from drivers during registration.

## 2026-05-20

- Initial commit.
- Render deployment configuration: move `render.yaml` to the repo root with the correct `rootDir`, add the Redis `ipAllowList`.
