# Expo dependency audit triage

Issue #31 started from the report of 42 findings in each Expo app. A fresh audit on the current lockfiles reported **40 findings per app before remediation** and **38 findings per app after the safe Axios upgrade**. The two apps have materially identical audit profiles.

| Audit state | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Before remediation | 2 | 17 | 15 | 6 | 40 |
| After Axios upgrade | 2 | 15 | 15 | 6 | 38 |

## Remediation completed

Axios was upgraded from the vulnerable `1.13.2` line to `^1.19.0` in both Expo apps. This was the only direct remediation available without changing the Expo SDK major version. The Passenger and Driver test suites and TypeScript checks must pass before this upgrade is merged; the validation results are recorded with the issue.

## Findings that were intentionally not force-upgraded

The remaining high and critical findings are primarily in the Expo/Metro build toolchain: `expo`, `@expo/cli`, `@expo/metro`, `metro`, `image-size`, `postcss`, `shell-quote`, `tar`, `undici`, and related transitive packages. npm identifies the main fixes as an upgrade to Expo 57, which is a major SDK migration from the apps’ current Expo 54 line. Applying `npm audit fix --force` would therefore alter the native/runtime dependency graph and could break React Native compatibility, config plugins, EAS builds, or existing platform behavior.

The remaining direct-package decisions are as follows:

| Package or group | Decision | Reason |
|---|---|---|
| `expo` and Expo SDK modules | Defer to a dedicated SDK migration | The audit fix is a major Expo 57 upgrade and must be coordinated with React Native, native modules, EAS, and physical-device validation. |
| `@expo/ngrok` | Retain temporarily | npm reports no automatic fix; it is a development tunnel utility rather than an app runtime dependency. Replace or remove it if the development workflow no longer needs it. |
| `@rork-ai/toolkit-sdk` and AI transitive packages | Defer vendor-compatible upgrade | npm proposes a breaking package change to an older-looking version line; do not downgrade or override without vendor confirmation and app verification. |
| `@babel/core` | Track separately | Low-severity build-time issue; update only after confirming the Expo 54-compatible Babel range. |
| Transitive Metro/toolchain packages | Defer with Expo migration | Direct overrides can produce an unsupported Metro/native combination. |

The audit has **not** been silenced with an `overrides` block, and no `npm audit fix --force` command was run.

## Repeatable audit commands

Run these commands separately from each Expo app directory:

```bash
npm audit --json > audit.json
npm audit --omit=dev
npm ls --all --json > dependency-tree.json
```

Before any future dependency update, run the complete Passenger and Driver test suites, TypeScript checks, and an EAS development/preview build. The next safe remediation tranche is a planned Expo SDK migration with a compatibility matrix for `expo-router`, `expo-dev-client`, notifications, location, SQLite, secure storage, maps, Firebase, and native build configuration.

## References

[1]: https://docs.npmjs.com/cli/v10/commands/npm-audit "npm audit documentation"

[2]: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/ "Expo SDK upgrade walkthrough"

[3]: https://docs.expo.dev/eas/environment-variables/ "EAS environment variables documentation"
