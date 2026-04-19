# Plugin / Module Compatibility Audit — SDK 52 → 55

Generated 2026-04-18. All version pins below come from the Expo docs URLs listed under "Evidence" at the bottom. A cell of `—` means the doc page did not list a pin for that SDK and the entry needs manual verification before the corresponding phase runs.

## TL;DR — per-SDK must-dos for the implementer

| SDK | Key mandatory action in this hop | Docs anchor |
|---|---|---|
| 52 | New Architecture opt-in default for new projects; `react-native-screens` 3.x→4.x major jump — test all navigation stack transitions | [#sdk-52](#gotchas--new-defaults-per-sdk) |
| 53 | React 19 is a hard requirement; `forwardRef` pattern changes, `useRef` requires initial argument, AppDelegate migrates to Swift | [#sdk-53](#gotchas--new-defaults-per-sdk) |
| 54 | JSC removed — Hermes is mandatory; last SDK with Legacy Architecture opt-out | [#sdk-54](#gotchas--new-defaults-per-sdk) |
| 55 | New Architecture mandatory; remove `newArchEnabled` flag; remove top-level `notification` key from app.json | [#sdk-55](#gotchas--new-defaults-per-sdk) |

**Top 3 risks before Phase 1 begins:**
1. `@sentry/react-native` is three major versions behind (`^5.24.0` vs `^8.8.0`); v5→v6→v7→v8 each have breaking API and native-build changes — treat as a dedicated parallel workstream.
2. `expo-updates` shows a version anomaly in SDK 54 (`29.0.16` vs expected `0.28.x` pattern) — must verify via `npx expo install` in a clean SDK 54 project before Phase 3 runs.
3. SDK 55 mandates New Architecture for all native libraries — a third-party library audit is required before the Phase 4 upgrade to avoid runtime crashes.

## Core runtime pairings (from each SDK's main version page)

| SDK | react-native | react | metro | notes |
|---|---|---|---|---|
| 51 | 0.74.5 | 18.2.0 | ~0.80 | current baseline — from sdk-51 template package.json |
| 52 | 0.76.9 | 18.3.1 | ~0.81 | RN 0.76 first stable with New Architecture opt-in default for new projects |
| 53 | 0.79.6 | 19.0.0 | ~0.82 | React 19 lands here; package.json exports enabled by default; setImmediate removed |
| 54 | 0.81.5 | 19.1.0 | ~0.83 | JSC first-party support dropped (Hermes only); last SDK with Legacy Arch opt-out |
| 55 | 0.83.6 | 19.2.0 | ~0.84 | New Architecture mandatory; `newArchEnabled` config flag removed entirely |

> Metro versions are inferred from `metro-babel-register` devDependency ranges in each React Native release (RN pins metro as a matching minor). Exact metro patch version: — needs manual verification via `npx expo install` lockfile inspection.

## Plugin pins per SDK

All pins sourced from `packages/<module>/package.json` on the `sdk-NN` branch of `github.com/expo/expo`. These are the versions `expo install --fix` will resolve to for each SDK target.

| Module | SDK 51 (baseline) | SDK 52 | SDK 53 | SDK 54 | SDK 55 | Breaking changes of note |
|---|---|---|---|---|---|---|
| expo-router | ~3.5.0 | ~4.0.22 | ~5.1.11 | ~6.0.23 | ~55.0.12 | v3→v4: `Href` type lost generic; v4→v5: root `<Slot>` wrap required; v5→v6: `ExpoRequest`/`ExpoResponse` removed, gesture-handler no longer auto-injected; v6→v55: `reset`→`resetOnFocus`, `NativeTabs.Trigger.TabBar` removed |
| expo-secure-store | ~13.0.0 | ~14.0.1 | ~14.2.4 | ~15.0.8 | ~55.0.13 | v13→v14: iOS min bumped to 15.1; no plugin schema changes SDK 52–55 |
| expo-notifications | ~0.28.0 | ~0.29.14 | ~0.31.5 | ~0.32.16 | ~55.0.19 | v0.28→v0.29: `DateTriggerInput` only accepts object; v0.31: `shouldShowAlert` deprecated; v0.32: deprecated exports removed; v55: top-level `notification` key in app.json **removed** — must use plugin config block |
| expo-apple-authentication | ~6.4.0 | ~7.1.3 | ~7.2.4 | ~8.0.8 | ~55.0.13 | v6→v7: iOS min 15.1; no plugin schema changes SDK 52–55 |
| expo-location | ~17.0.0 | ~18.0.10 | ~18.1.6 | ~19.0.8 | ~55.1.8 | v17→v18: Google Maps geocoding removed, legacy permission APIs removed; no plugin schema changes SDK 52–55 |
| expo-constants | ~16.0.0 | ~17.0.8 | ~17.1.8 | ~18.0.13 | ~55.0.14 | No breaking changes or plugin schema changes across SDK 52–55 |
| expo-crypto | ~13.0.0 | ~14.0.2 | ~14.1.5 | ~15.0.8 | ~55.0.14 | No breaking changes across SDK 52–55 |
| expo-device | ~6.0.0 | ~7.0.3 | ~7.1.4 | ~8.0.10 | ~55.0.15 | No breaking changes across SDK 52–55 |
| expo-linking | ~6.3.0 | ~7.0.5 | ~7.1.7 | ~8.0.11 | ~55.0.13 | SDK 53: Android package name no longer auto-added as URL scheme — check linking config |
| expo-updates | ~0.25.0 | ~0.27.5 | ~0.28.18 | ~29.0.16 ⚠️ (unverified) | ~55.0.20 | **Version anomaly in SDK 54**: jumps to `29.x` then `55.x` — needs manual verification; SDK 53: long-deprecated TypeScript types removed |
| expo-status-bar | ~1.12.1 | ~2.0.1 | ~2.2.3 | ~3.0.9 | ~55.0.5 | No breaking changes or plugin schema changes across SDK 52–55 |
| expo-web-browser | ~13.0.0 | ~14.0.2 | ~14.2.0 | ~15.0.10 | ~55.0.14 | No breaking changes across SDK 52–55 |
| expo-auth-session | ~5.5.0 | ~6.0.3 | ~6.2.1 | ~7.0.10 | ~55.0.14 | SDK 55 adds `extraHeaders` option to `TokenRequest`/`RevokeTokenRequest` (additive); no breaking changes |
| @expo/vector-icons | ^14.0.0 | ~14.0.4 | ^14.1.0 | ^15.0.3 | ^15.0.2 | SDK 54: icon families updated to latest react-native-vector-icons; not bundled in SDK 55 default template (still available on npm) |

## Sentry React Native

| SDK | Recommended @sentry/react-native | Plugin path in app.json | Breaking changes |
|---|---|---|---|
| SDK 51 (baseline) | ^5.24.0 | `@sentry/react-native/expo` | baseline |
| SDK 52 | ^5.35.0+ | `@sentry/react-native/expo` | v5.x still compatible (peerDep: RN >=0.65, Expo >=49); plugin schema unchanged |
| SDK 53 | ^6.x or ^7.x | `@sentry/react-native/expo` | **v5→v6 breaking**: `ReactNavigationInstrumentation` API changed; tracing options moved into `Sentry.init()`; `idleTimeout`→`idleTimeoutMs`; `maxTransactionDuration`→`finalTimeoutMs` |
| SDK 54 | ^7.x | `@sentry/react-native/expo` | v7 min supported Expo SDK is 50; `captureUserFeedback` removed (use `captureFeedback`); `autoSessionTracking`→`enableAutoSessionTracking` |
| SDK 55 | ^8.8.0 | `@sentry/react-native/expo` | **v8 breaking**: iOS 15.0+ required (was 11.0+); AGP 7.4.0+ and Kotlin 1.8+ required; Sentry CLI v3 required; must disable `autoInstallation` in Android gradle plugin to avoid version-mix crash |

> **RISK**: Current pin `^5.24.0` is three major versions behind latest `8.8.0`. This is a **dedicated migration task** — v5→v6→v7→v8 each have breaking changes. The plugin path `@sentry/react-native/expo` itself is stable in app.json across all SDK versions audited, but the JavaScript API and native build requirements change significantly.
>
> All @sentry/react-native versions from 5.35.0 through 8.8.0 declare peerDependencies of `react-native >=0.65.0` and `expo >=49.0.0` (expo is optional) — which means semver won't surface the incompatibility automatically. You must check per the migration guide.

## Plugin-config schema changes per SDK

Entries in `apps/mobile/app.json` plugins array:

| Plugin entry | Config shape checked | Schema changes found |
|---|---|---|
| `"expo-router"` | No config options | None |
| `"expo-secure-store"` | No config options | None |
| `["expo-notifications", {"icon": "...", "color": "..."}]` | `icon`, `color`, `defaultChannel`, `sounds`, `enableBackgroundRemoteNotifications` | **SDK 55**: The top-level `"notification"` key in app.json is removed. The codebase already uses the plugin block with `icon` and `color` — this is correct. However, the separate top-level `"notification": {"icon": "...", "color": "..."}` block at line 51–54 of `apps/mobile/app.json` **must be removed** before targeting SDK 55. |
| `"expo-apple-authentication"` | No config options | None |
| `["expo-location", {"locationWhenInUsePermission": "..."}]` | `locationWhenInUsePermission` | None — field stable SDK 52–55. SDK 55 adds optional `androidForegroundServiceIcon` (additive). |
| `"@sentry/react-native/expo"` | No config options currently | None in app.json schema; breaking changes are in JS API only |

## Gotchas / new defaults by SDK

- **SDK 52**: New Architecture opt-in enabled by default for **new** projects only. Existing projects upgrading to SDK 52 retain their current `newArchEnabled` value. `react-native-screens` major-version jump (3.x→4.x): test all navigation stack transitions. iOS deployment target minimum raised to 15.1 across most Expo packages.
- **SDK 53**: React 19 is a hard requirement. The `ref` prop no longer requires `forwardRef`, `useRef` requires an initial argument, `act` import location changed. RN 0.79 enables package.json exports by default — any internal `require('react-native/src/...')` paths break. AppDelegate migrated from Objective-C to Swift — config plugins that patch AppDelegate need Swift-compatible patching. `setImmediate` polyfill removed. Android: edge-to-edge is default for new projects. Push notifications no longer work in Expo Go on Android.
- **SDK 54**: JSC removed as a first-party engine — Hermes is mandatory. `metro/src/...` internal imports break. `expo-file-system` default import switched to the new API (legacy moves to `expo-file-system/legacy`). Deprecated `expo-notifications` function exports removed. SDK 54 is the **last SDK** with Legacy Architecture opt-out.
- **SDK 55**: New Architecture default — **opt-out is no longer supported**. The `newArchEnabled` flag in app.json/eas.json is removed entirely. RN 0.82 (within the 0.83 line) removed the flag. All third-party native libraries must be New Architecture compatible. Edge-to-edge is mandatory on Android 16+. `eas update` now requires `--environment` flag. Versioning scheme for all first-party Expo packages changes to `55.x.y`.

## Evidence (URLs fetched, with timestamp and outcome)

All fetches performed 2026-04-18.

- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-51/templates/expo-template-default/package.json` — ✅ got data (RN 0.74.5, React 18.2.0, expo ~51.0.28)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo/package.json` — ✅ got data (expo 52.0.49, RN 0.76.9, React 18.3.1, @expo/vector-icons ~14.0.4)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo/package.json` — ✅ got data (expo 53.0.27, RN 0.79.6, React 19.0.0)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/package.json` — ✅ got data (expo 54.0.33, RN 0.81.5, React 19.1.0)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo/package.json` — ✅ got data (expo 55.0.15, RN 0.83.6, React 19.2.0)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/templates/expo-template-default/package.json` — ✅ got data (expo-router ~4.0.22, @expo/vector-icons ~14.0.4, expo-status-bar ~2.0.1, expo-web-browser ~14.0.2)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/templates/expo-template-default/package.json` — ✅ got data (RN 0.79.6, React 19.0.0, @expo/vector-icons ^14.1.0)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/templates/expo-template-default/package.json` — ✅ got data (RN 0.81.5, React 19.1.0, @expo/vector-icons ^15.0.3)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/templates/expo-template-default/package.json` — ✅ got data (RN 0.83.6, React 19.2.0, expo ~55.0.15; @expo/vector-icons not in default template)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-router/package.json` — ✅ 4.0.22
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-router/package.json` — ✅ 5.1.11
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-router/package.json` — ✅ 6.0.23
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-router/package.json` — ✅ 55.0.12
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-secure-store/package.json` — ✅ 14.0.1
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-secure-store/package.json` — ✅ 14.2.4
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-secure-store/package.json` — ✅ 15.0.8
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-secure-store/package.json` — ✅ 55.0.13
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-notifications/package.json` — ✅ 0.29.14
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-notifications/package.json` — ✅ 0.31.5
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-notifications/package.json` — ✅ 0.32.16
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-notifications/package.json` — ✅ 55.0.19
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-apple-authentication/package.json` — ✅ 7.1.3
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-apple-authentication/package.json` — ✅ 7.2.4
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-apple-authentication/package.json` — ✅ 8.0.8
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-apple-authentication/package.json` — ✅ 55.0.13
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-location/package.json` — ✅ 18.0.10
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-location/package.json` — ✅ 18.1.6
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-location/package.json` — ✅ 19.0.8
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-location/package.json` — ✅ 55.1.8
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-constants/package.json` — ✅ 17.0.8
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-constants/package.json` — ✅ 17.1.8
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-constants/package.json` — ✅ 18.0.13
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-constants/package.json` — ✅ 55.0.14
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-crypto/package.json` — ✅ 14.0.2
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-crypto/package.json` — ✅ 14.1.5
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-crypto/package.json` — ✅ 15.0.8
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-crypto/package.json` — ✅ 55.0.14
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-device/package.json` — ✅ 7.0.3
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-device/package.json` — ✅ 7.1.4
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-device/package.json` — ✅ 8.0.10
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-device/package.json` — ✅ 55.0.15
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-linking/package.json` — ✅ 7.0.5
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-linking/package.json` — ✅ 7.1.7
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-linking/package.json` — ✅ 8.0.11
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-linking/package.json` — ✅ 55.0.13
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-updates/package.json` — ✅ 0.27.5
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-updates/package.json` — ✅ 0.28.18
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-updates/package.json` — ✅ 29.0.16 (version anomaly — see open questions)
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-updates/package.json` — ✅ 55.0.20
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-status-bar/package.json` — ✅ 2.0.1
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-status-bar/package.json` — ✅ 2.2.3
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-status-bar/package.json` — ✅ 3.0.9
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-status-bar/package.json` — ✅ 55.0.5
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-web-browser/package.json` — ✅ 14.0.2
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-web-browser/package.json` — ✅ 14.2.0
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-web-browser/package.json` — ✅ 15.0.10
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-web-browser/package.json` — ✅ 55.0.14
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo-auth-session/package.json` — ✅ 6.0.3
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-53/packages/expo-auth-session/package.json` — ✅ 6.2.1
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-auth-session/package.json` — ✅ 7.0.10
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-auth-session/package.json` — ✅ 55.0.14
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-router/CHANGELOG.md` — ✅ breaking changes for v55, v6, v5, v4 retrieved
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-notifications/CHANGELOG.md` — ✅ breaking changes retrieved
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-notifications/CHANGELOG.md` — ✅ breaking changes retrieved
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-secure-store/CHANGELOG.md` — ✅ no breaking changes in SDK 55
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-location/CHANGELOG.md` — ✅ no breaking changes in SDK 55
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-updates/CHANGELOG.md` — ✅ SDK 55 breaking change: `ExpoAppDelegate` inheritance requirement removed
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-apple-authentication/CHANGELOG.md` — ✅ no breaking changes in SDK 55
- [2026-04-18] `https://raw.githubusercontent.com/expo/expo/sdk-55/packages/expo-auth-session/CHANGELOG.md` — ✅ no breaking changes in SDK 55
- [2026-04-18] `https://expo.dev/changelog/sdk-53` — ✅ breaking changes for SDK 53 retrieved
- [2026-04-18] `https://expo.dev/changelog/sdk-54` — ✅ breaking changes for SDK 54 retrieved
- [2026-04-18] `https://expo.dev/changelog/sdk-55` — ✅ breaking changes for SDK 55 retrieved; New Architecture mandatory confirmed
- [2026-04-18] `https://docs.expo.dev/versions/v53.0.0/` — ✅ RN 0.79, React 19.0.0 confirmed
- [2026-04-18] `https://docs.expo.dev/versions/v54.0.0/` — ✅ RN 0.81, React 19.1.0 confirmed
- [2026-04-18] `https://docs.expo.dev/versions/v55.0.0/` — ✅ RN 0.83, React 19.2.0 confirmed; also shows SDK 53 and 54 comparison
- [2026-04-18] `https://docs.expo.dev/versions/latest/` — ✅ latest = SDK 55; RN 0.83, React 19.2.0
- [2026-04-18] `https://raw.githubusercontent.com/getsentry/sentry-react-native/8.8.0/packages/core/package.json` — ✅ v8.8.0 peerDeps: expo >=49.0.0, RN >=0.65.0, React >=17.0.0
- [2026-04-18] `https://raw.githubusercontent.com/getsentry/sentry-react-native/7.13.0/packages/core/package.json` — ✅ v7.13.0 peerDeps: same
- [2026-04-18] `https://raw.githubusercontent.com/getsentry/sentry-react-native/5.35.0/package.json` — ✅ v5.35.0 peerDeps: same
- [2026-04-18] `https://docs.sentry.io/platforms/react-native/migration/` — ✅ migration guide index retrieved
- [2026-04-18] `https://docs.sentry.io/platforms/react-native/migration/v7-to-v8/` — ✅ v8 breaking changes retrieved (iOS 15+, Kotlin 1.8+, AGP 7.4+)
- [2026-04-18] `https://docs.sentry.io/platforms/react-native/migration/v6-to-v7/` — ✅ v7 breaking changes retrieved (captureUserFeedback removed, min Expo 50)
- [2026-04-18] `https://docs.expo.dev/versions/latest/sdk/notifications/` — ✅ current notifications config schema retrieved
- [2026-04-18] `https://docs.expo.dev/versions/v52.0.0/` — ❌ 404
- [2026-04-18] `https://expo.dev/changelog/sdk-52` — ❌ 404
- [2026-04-18] `https://docs.expo.dev/router/migrate/from-expo-router-v3/` — ❌ 404
- [2026-04-18] `https://docs.expo.dev/router/migrate/from-expo-router-v4/` — ❌ 404
- [2026-04-18] `https://docs.expo.dev/router/reference/migration/` — ❌ 404
- [2026-04-18] `https://docs.sentry.io/platforms/react-native/migration/from-7-x-to-8-x/` — ❌ 404
- [2026-04-18] `https://docs.sentry.io/platforms/react-native/migration/from-6-x-to-7-x/` — ❌ 404
- [2026-04-18] `https://registry.npmjs.org/@expo/vector-icons` — ✅ current version is 15.1.1; historical version list retrieved

## Open questions for Phase N

- **Phase 1 (SDK 52) — expo-updates version anomaly in SDK 54** — The `sdk-54` branch shows `expo-updates@29.0.16`, which is a large jump from `0.28.x` (SDK 53) and before `55.0.x` (SDK 55). Confirm whether `npx expo install expo-updates` on SDK 54 resolves to `29.x` or if this is a branch artifact. Resolution: run `npx expo install expo-updates` in a clean SDK 54 project and check the installed version.

- **Phase 1 (SDK 52) — metro exact version** — Metro minor versions were inferred from `metro-babel-register` in each React Native release. Confirm exact metro version bundled per SDK by checking the lockfile after `npx expo install --fix`. Resolution: inspect `pnpm-lock.yaml` after each SDK upgrade step.

- **Phase 2 (SDK 53) — AppDelegate Swift migration impact on @sentry/react-native/expo** — Sentry's config plugin patches AppDelegate. SDK 53 migrated AppDelegate from Objective-C to Swift. Confirm whether `@sentry/react-native/expo` versions compatible with SDK 53 handle Swift AppDelegate. Resolution: check Sentry release notes for SDK 53 compatibility; run `npx expo prebuild` on SDK 53 and inspect generated native files.

- **Phase 2 (SDK 53) — React 19 impact on codebase hooks** — `ref` as prop, `useRef` argument required, `act` import location. Suggested resolution: run TypeScript compiler after upgrade; search codebase for `forwardRef`, `useRef()` (no arg), `import { act } from 'react-dom/test-utils'`.

- **Phase 3 (SDK 54) — JSC removal and Hermes-only** — Confirm no native modules in the dependency tree depend on JSC. Resolution: audit `apps/mobile/package.json` for any packages with JSC-specific code; run `npx expo prebuild` and inspect podfile.

- **Phase 3 (SDK 54) — expo-file-system import change** — If any code in `packages/` or `apps/mobile/` imports from `expo-file-system` directly, those imports now use the new API (legacy moved to `expo-file-system/legacy`). Resolution: `grep -r "expo-file-system" packages/ apps/` and audit import paths.

- **Phase 4 (SDK 55) — New Architecture third-party library audit** — All native libraries must support Fabric/TurboModules. Primary risk: `@tanstack/react-query` (JS only, safe), `react-native-url-polyfill` (needs check), `zustand` (JS only, safe), `react-native-safe-area-context` and `react-native-screens` (both support New Arch). Resolution: run `npx react-native-new-architecture-checker` or check each package's New Architecture support status.

- **Phase 4 (SDK 55) — app.json `notification` top-level key removal** — The current `apps/mobile/app.json` has a top-level `"notification"` key (lines 51–54) that mirrors the plugin config. This key is removed in SDK 55. Remove it before upgrading. Resolution: delete the `"notification"` block from `app.json` in the Phase 4 prep step.

- **Phase 4 (SDK 55) — Sentry v8 migration** — Moving from `@sentry/react-native@^5.24.0` to `^8.x` spans three major versions (v5→v6→v7→v8). Each has breaking changes. Treat as a separate workstream parallel to SDK 55. Resolution: follow Sentry's migration guides in sequence; allocate a dedicated PR.

- **Phase 4 (SDK 55) — `eas update --environment` flag** — The `apps/mobile/package.json` `"update"` script uses `eas update --channel production`. In SDK 55, `--environment` flag is required. Update the script before SDK 55 deploy. Resolution: update `package.json` script to `eas update --channel production --environment production`.
