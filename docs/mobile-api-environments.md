# Mobile API environments

Issue #29 separates the Passenger and Driver Expo apps into explicit development, staging, and production API environments. Both apps now resolve `EXPO_PUBLIC_API_ENV` through a dedicated `services/apiEnvironment.ts` module and use the same environment names and safeguards.

| Environment | Default API | Intended use |
|---|---|---|
| `development` | `http://localhost:4000` | Local simulator or a device configured with an explicit LAN-IP override via `EXPO_PUBLIC_API_URL`. |
| `staging` | `https://trotro-staging-api.onrender.com` | Internal QA, acceptance testing, and preview builds. |
| `production` | `https://trotro-api.onrender.com` | Store/release builds only. |

The resolver trims trailing slashes, requires an absolute HTTP(S) URL, rejects unknown environment names, and prevents production builds from targeting the staging hostname or staging builds from targeting the production hostname. The apps do not silently fall back to the production API when the environment is omitted; the default is development.

## EAS profiles

Both apps’ `eas.json` files now assign the following environment values:

| EAS profile | `EXPO_PUBLIC_API_ENV` |
|---|---|
| `development` | `development` |
| `preview` | `staging` |
| `production` | `production` |

Build commands are run from the relevant Expo app directory:

```bash
# Internal development client
eas build --profile development --platform android

# Staging/QA build
eas build --profile preview --platform android

# Production release
eas build --profile production --platform android
```

For local physical-device development, set `EXPO_PUBLIC_API_URL` to the computer’s LAN address, for example `http://192.168.1.100:4000`, while keeping `EXPO_PUBLIC_API_ENV=development`. Do not put production or staging secrets in Expo variables. These values are public build configuration, not credentials.

Before distributing a build, verify the resolved URL in the build logs or an internal diagnostic screen and confirm that the release profile and backend environment match. A production build must never use a staging API, and a staging build must never use a production API.
