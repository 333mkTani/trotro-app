# Mobile release build and device validation

Issue #30 prepares the Passenger and Driver Expo apps for signed EAS builds and physical-device acceptance. Both apps now have unique deep-link schemes, explicit location permission descriptions, deduplicated or explicit Android permissions, and EAS profiles mapped to the correct development, staging, and production API environments.

| App | Deep-link scheme | Android package | iOS bundle identifier |
|---|---|---|---|
| Passenger | `trotro-passenger` | `app.rork.xhzxzlgi78rh6x1hlotnk` | `app.rork.xhzxzlgi78rh6x1hlotnk` |
| Driver | `trotro-driver` | `app.rork.ail0erz48fpe3wt4vgrgo` | `app.rork.ail0erz48fpe3wt4vgrgo` |

## Build profiles

Run the following from the relevant Expo app directory after EAS credentials and provider configuration are available:

```bash
eas build --profile development --platform android

eas build --profile preview --platform all

eas build --profile production --platform all
```

The development profile targets the development API, preview targets staging, and production targets the production API. Production signing and store submission are intentionally not performed automatically by this repository change because they require the owner’s EAS account, Apple Developer credentials, Android signing credentials, and explicit release approval.

## Local prerequisite check

From the repository root, run:

```bash
node scripts/verify-mobile-release-config.mjs
```

The verifier checks app identifiers, unique schemes, EAS API environment mapping, icon/splash assets, Firebase configuration files, notifications, and location plugins. The repository currently contains `google-services.json` for both apps but does not contain the iOS `GoogleService-Info.plist` files. Those files must be supplied through protected EAS credentials or added through the approved secret-file workflow before iOS builds can succeed. They must not be committed if they contain project credentials.

## Physical-device acceptance matrix

| Area | Passenger | Driver | Evidence |
|---|---|---|---|
| Signed install and cold start | Android release APK/AAB and iOS archive | Android release APK/AAB and iOS archive | Build IDs, device OS versions, install logs |
| API environment | Preview build reaches staging only | Preview build reaches staging only | Sanitized resolved API environment and `/ready` result |
| Registration/login/session restore | Required | Required | Auth success, restart, token refresh, logout |
| Push notifications | Booking, cancellation, route/bus alerts, cold-start tap | Requests, status changes, schedule alerts, cold-start tap | FCM/APNs receipt and navigation evidence |
| Deep links | `trotro-passenger://` and Paystack callback | `trotro-driver://` and QR/notification routes | Cold and warm link launch evidence |
| Maps and location | Foreground location, nearby stops, map rendering | Foreground/background location, map rendering, live GPS | Permission prompts, coordinates, battery/background behavior |
| Offline sync | Queue mutation offline, reconnect, conflict result | Queue GPS/status intent offline, reconnect, server result | Local queue and server reconciliation evidence |
| Camera and QR | Not applicable unless enabled | Camera permission, scan, redeem boarding code | Scan success and denial/retry behavior |
| Realtime | Socket connect/reconnect and booking updates | Socket connect/reconnect and location/request updates | Reconnect logs and duplicate-event check |

Test at least one supported Android release device and one supported iOS device per app. Repeat notification and deep-link checks after a force-stop and after reinstalling the build. Validate background location on a physical Driver device while the app is backgrounded; simulators are insufficient for this acceptance.

## Release blockers

The missing iOS Firebase plist files are a hard iOS build prerequisite. The actual signed builds and physical-device checks also remain operator actions because this session does not have the Apple/Google signing credentials, physical devices, APNs/FCM delivery access, or explicit production release approval. Attach sanitized build IDs and the acceptance matrix to issue #30 before closing it.

## References

[1]: https://docs.expo.dev/build/introduction/ "Expo application services build introduction"

[2]: https://docs.expo.dev/build-reference/variants/ "Expo build variants and profiles"

[3]: https://docs.expo.dev/guides/linking/ "Expo linking and deep-linking guide"

[4]: https://docs.expo.dev/push-notifications/overview/ "Expo push notifications overview"
