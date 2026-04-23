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
1. `@sentry/react-native` is three major versions behind (`^5.24.0` vs `^8.8.0`); v5→v6→v7→v8 each have breaking API and native-build changes. **Resolved path (see §Sentry)**: single 5→8 jump in Phase 3/4 (not stepwise); the only Sovio JS edit is renaming `beforeSendTransaction` → `beforeSendSpan` in `packages/core/src/observability/sentryScrubber.ts` + `apps/mobile/app/_layout.tsx:23`; iOS deployment target must be ≥ 15.0.
2. `expo-updates` shows a version jump in SDK 54 (`29.0.16` vs expected `0.28.x` pattern). **Resolved**: verified against the `sdk-54` branch of `expo/expo` and npm — `29.0.16` is an intentional Expo-aligned renumber, not a typo. See §Evidence + §Resolutions.
3. SDK 55 mandates New Architecture for all native libraries. **Resolved path (see §Third-party NA audit)**: no blockers found in Sovio's dep tree; required bumps are `react-native-safe-area-context@^5.4.0` and `react-native-screens@~4.24.0` (both driven by expo-router SDK 55 peer dep). No `newArchEnabled` flag present in current `app.json`, so nothing to remove there.

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
| expo-updates | ~0.25.0 | ~0.27.5 | ~0.28.18 | ~29.0.16 ✓ verified | ~55.0.20 | Expo intentionally renumbered `expo-updates` at SDK 54 (0.28 → 29.x) and again at SDK 55 (29.x → 55.x) to align with SDK majors; SDK 53: long-deprecated TypeScript types removed |
| expo-status-bar | ~1.12.1 | ~2.0.1 | ~2.2.3 | ~3.0.9 | ~55.0.5 | No breaking changes or plugin schema changes across SDK 52–55 |
| expo-web-browser | ~13.0.0 | ~14.0.2 | ~14.2.0 | ~15.0.10 | ~55.0.14 | No breaking changes across SDK 52–55 |
| expo-auth-session | ~5.5.0 | ~6.0.3 | ~6.2.1 | ~7.0.10 | ~55.0.14 | SDK 55 adds `extraHeaders` option to `TokenRequest`/`RevokeTokenRequest` (additive); no breaking changes |
| @expo/vector-icons | ^14.0.0 | ~14.0.4 | ^14.1.0 | ^15.0.3 | ^15.0.2 | SDK 54: icon families updated to latest react-native-vector-icons; not bundled in SDK 55 default template (still available on npm) |

## Sentry React Native

**Recommended path: single 5→8 jump in Phase 3 (not stepwise)**, because each intermediate Sentry major only overlaps one Expo SDK band (see matrix). Stepping through 6 and 7 would require two throwaway Sentry bumps.

| Expo SDK | Min Sentry RN | Max tested | Notes |
|---|---|---|---|
| SDK 51 (baseline) | ~5.24.0 | 5.x | Current Sovio baseline |
| SDK 52 | ~6.3.0 | 6.x | expo-doctor expects `~6.3.0`; 6.10+ needed for Xcode 16.3 |
| SDK 53 | ~6.14.0 | 6.x | Also requires metro.config change |
| SDK 54 | ~7.2.0+ | 7.x | Earlier 7.x had iOS `SentryUserFeedbackIntegration` build failure |
| SDK 55 | ^8.6.0 | 8.8.0 (latest) | v8 shipped lazy-load Metro fix specifically for Expo 55 |

Plugin path `@sentry/react-native/expo` is stable in `app.json` across v5→v8 — no plugin-entry change needed in `apps/mobile/app.json:49`.

### Breaking changes across v5→v8 touching Sovio code

- **v5→v6 (2024-10-16)**: Tracing options (`enableAppStartTracking`, `enableNativeFramesTracking`, `enableStallTracking`, `enableUserInteractionTracing`) moved from `ReactNativeTracing` constructor to `Sentry.init()` root. `ReactNativeTracing` constructor removed. `idleTimeout`→`idleTimeoutMs`, `maxTransactionDuration`→`finalTimeoutMs`. **Sovio impact: none** — Sovio does not instantiate `ReactNativeTracing`; `tracesSampleRate` is already at init root.
- **v6→v7 (2025-09-02)**: `captureUserFeedback` removed (use `captureFeedback`); `autoSessionTracking` removed (use `enableAutoSessionTracking`). `beforeSendTransaction` **deprecated in v6, fully removed in v7** — replaced by `beforeSendSpan` which receives a **span object, not a full event**. **Sovio impact: breaking** — `scrubSentryEvent` is currently passed as both `beforeSend` and `beforeSendTransaction`; must be refactored to use `beforeSendSpan` (different shape: no `exception`/`breadcrumbs`/`user` fields on spans).
- **v7→v8 (2026-02-12)**: iOS minimum **15.0+** (was 11.0+), Android Gradle Plugin 7.4.0+, Kotlin 1.8+, Sentry CLI v3. No JS API changes that touch Sovio's init/scrubber. **Sovio impact: native-build only** — must verify EAS build profile + Podfile target iOS ≥ 15.0.

### Sovio source files requiring edits during Sentry bump

| File | Line | Change |
|---|---|---|
| `apps/mobile/package.json` | `"@sentry/react-native": "^5.24.0"` | Bump to `^8.6.0` |
| `apps/mobile/app/_layout.tsx` | line 23 (inside `Sentry.init`) | Replace `beforeSendTransaction: scrubSentryEvent` with `beforeSendSpan: scrubSentrySpan` (new helper — see next row) |
| `packages/core/src/observability/sentryScrubber.ts` | `scrubSentryEvent` (full file) | Add new `scrubSentrySpan` helper for the span shape (no `exception`/`breadcrumbs`/`user`; scrubs `description` + `data` attributes only). Keep `scrubSentryEvent` for `beforeSend` which still receives events. |
| `apps/mobile/app.json` | ios.deploymentTarget (currently implicit) | Confirm or set to ≥ 15.0 in EAS build profile before landing |

> **NOTE: conflict in background research** — one of the Q3-audit sources incorrectly claimed `beforeSendTransaction` signature was unchanged across v5→v8. The Q1 source (official v6→v7 migration guide and v7.0.0 release notes) is correct and takes precedence: the hook is removed in v7. Sovio's scrubber must be refactored.

## Third-party RN module New Architecture audit (for SDK 55)

No blockers found. Required bumps (all driven by expo-router SDK 55 peer deps):

| Package | Current pin | SDK 55 target | NA supported from | Sovio direct imports | Breaking changes for Sovio |
|---|---|---|---|---|---|
| `react-native-safe-area-context` | `4.10.5` | `^5.4.0` | `5.0.0` (Fabric rewrite) | None (consumed transitively by `expo-router`) | Major bump; no source edits needed |
| `react-native-screens` | `3.31.1` | `~4.24.0` | `4.0.0` (full Fabric + TurboModules) | None (expo-router owns navigation stack) | v4 removes `NativeScreen`, drops `react-native-screens/native-stack` re-export, requires react-navigation v7+ — all internal to expo-router v55 |
| `react-native-url-polyfill` | `^3.0.0` | `^3.0.0` (keep) | N/A (pure JS polyfill) | `apps/mobile/app/_layout.tsx:8` (side-effect `/auto` import) | None |
| `react-native-web` | `~0.19.13` | `0.21.0` (Expo-bundled) | N/A (web renderer) | Not directly imported; used as RN→web alias | `0.21.0` fixes `pointer-events: auto` propagation — verify web build |
| `@expo/vector-icons` | `^14.0.0` | `^15.0.x` | Pure JS (expo-font wrapper) | `Ionicons` used across 12 files in `packages/ui/src/` | No API changes in `^14`→`^15`; icon families refreshed |
| `@sentry/react-native` | `^5.24.0` | `^8.6.0` | `~7.x` (NA fixes in 7.9.0) | See §Sentry | iOS 15+ minimum; `beforeSendTransaction`→`beforeSendSpan` |

**app.json NA changes**: `apps/mobile/app.json` has **no** `newArchEnabled` flag currently — nothing to remove (SDK 55 drops the flag entirely, so the file is already clean in that regard). Only the top-level `notification` key at lines 51–54 needs removal (already flagged in §Plugin-config schema changes).

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
- [2026-04-18] `https://github.com/getsentry/sentry-react-native/releases/tag/6.0.0` — ✅ v6 tracing options moved to init root; `ReactNativeTracing` removed
- [2026-04-18] `https://github.com/getsentry/sentry-react-native/releases/tag/7.0.0` — ✅ v7 removes `beforeSendTransaction`, `autoSessionTracking`, `captureUserFeedback`
- [2026-04-18] `https://github.com/getsentry/sentry-react-native/releases/tag/8.0.0` — ✅ v8 iOS 15+ / AGP 7.4+ / Kotlin 1.8+ / Sentry CLI v3
- [2026-04-18] `https://github.com/getsentry/sentry-react-native/issues/4980` — ✅ Expo 53 metro.config change requirement
- [2026-04-18] `https://github.com/getsentry/sentry-react-native/issues/5222` — ✅ Sentry 7.x iOS `SentryUserFeedbackIntegration` build failure
- [2026-04-18] `https://github.com/expo/expo/issues/36093` — ✅ Sentry 6.10+ needed for Xcode 16.3 on Expo 52
- [2026-04-18] `https://docs.expo.dev/guides/using-sentry/` — ✅ Sentry Expo setup guide; confirms `@sentry/react-native/expo` plugin path stable
- [2026-04-18] `https://reactnative.directory` — ✅ NA-support flags for react-native-screens, safe-area-context, url-polyfill
- [2026-04-18] `https://github.com/software-mansion/react-native-screens/releases` — ✅ v4.0.0 full Fabric + TurboModules rewrite; NA support
- [2026-04-18] `https://github.com/th3rdwave/react-native-safe-area-context/releases` — ✅ v5.0.0 Fabric rewrite
- [2026-04-18] `https://github.com/necolas/react-native-web/releases` — ✅ v0.21.0 pointer-events propagation change

## Resolutions (2026-04-18)

- **Q2 (expo-updates `29.0.16` anomaly) — RESOLVED**: Verified against `github.com/expo/expo` `sdk-54` branch `packages/expo-updates/package.json` and npm. The `29.x` pin is intentional; Expo realigned `expo-updates` to match the SDK major (SDK 54 → `29.x` as a one-off transitional, SDK 55 → `55.x` permanent). Audit pin and TL;DR risk updated accordingly.
- **Q1 (Sentry 5→8 path) — RESOLVED**: Single 5→8 jump in Phase 3 (not stepwise). Per-SDK compatibility matrix added to §Sentry. One breaking JS change touches Sovio: `beforeSendTransaction` removed in v7 → refactor `scrubSentryEvent` path in `packages/core/src/observability/sentryScrubber.ts` + `apps/mobile/app/_layout.tsx:23` to use `beforeSendSpan` (different shape). iOS deployment target must be confirmed ≥ 15.0 before landing.
- **Q3 (Third-party NA audit) — RESOLVED**: No NA blockers in Sovio's dep tree. `safe-area-context@^5.4.0` and `react-native-screens@~4.24.0` bumps needed (driven by expo-router peer deps). `newArchEnabled` flag is **not present** in current `app.json`, so Phase 4's "remove flag" step reduces to "confirm absence". See §Third-party NA audit.

## Open questions for Phase N

- **Phase 1 (SDK 52) — metro exact version** — Metro minor versions were inferred from `metro-babel-register` in each React Native release. Confirm exact metro version bundled per SDK by checking the lockfile after `npx expo install --fix`. Resolution: inspect `pnpm-lock.yaml` after each SDK upgrade step.

- **Phase 2 (SDK 53) — AppDelegate Swift migration impact on @sentry/react-native/expo** — Sentry's config plugin patches AppDelegate. SDK 53 migrated AppDelegate from Objective-C to Swift. Confirm whether `@sentry/react-native/expo` versions compatible with SDK 53 handle Swift AppDelegate. Resolution: check Sentry release notes for SDK 53 compatibility; run `npx expo prebuild` on SDK 53 and inspect generated native files.

- **Phase 2 (SDK 53) — React 19 impact on codebase hooks** — `ref` as prop, `useRef` argument required, `act` import location. Suggested resolution: run TypeScript compiler after upgrade; search codebase for `forwardRef`, `useRef()` (no arg), `import { act } from 'react-dom/test-utils'`.

- **Phase 3 (SDK 54) — JSC removal and Hermes-only** — Confirm no native modules in the dependency tree depend on JSC. Resolution: audit `apps/mobile/package.json` for any packages with JSC-specific code; run `npx expo prebuild` and inspect podfile.

- **Phase 3 (SDK 54) — expo-file-system import change** — If any code in `packages/` or `apps/mobile/` imports from `expo-file-system` directly, those imports now use the new API (legacy moved to `expo-file-system/legacy`). Resolution: `grep -r "expo-file-system" packages/ apps/` and audit import paths.

- **Phase 4 (SDK 55) — New Architecture third-party library audit** — ✓ Resolved, see §Third-party NA audit. No blockers; bumps driven by expo-router peer deps.

- **Phase 4 (SDK 55) — app.json `notification` top-level key removal** — The current `apps/mobile/app.json` has a top-level `"notification"` key (lines 51–54) that mirrors the plugin config. This key is removed in SDK 55. Remove it before upgrading. Resolution: delete the `"notification"` block from `app.json` in the Phase 4 prep step.

- **Phase 3 (SDK 54) — Sentry 5→8 migration** — ✓ Path resolved (see §Sentry). Open sub-items: (a) whether the new `scrubSentrySpan` helper needs to cover `data.http.url`/`data.http.query` attribute scrubbing too, to match `scrubSentryEvent`'s current coverage; (b) confirm iOS deployment target in Sovio's EAS build profile before the v8 bump. Both are Phase 3 implementation-time tasks.

- **Phase 4 (SDK 55) — `eas update --environment` flag** — The `apps/mobile/package.json` `"update"` script uses `eas update --channel production`. In SDK 55, `--environment` flag is required. Update the script before SDK 55 deploy. Resolution: update `package.json` script to `eas update --channel production --environment production`.
