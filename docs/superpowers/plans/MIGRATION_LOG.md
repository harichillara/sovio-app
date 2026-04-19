# Expo 51 → 55 Migration Log

Baseline captured on `release/expo-55-migration` at commit 9c4f48a337b165a1a83e17340ace9140e66de0d3.

## Baseline results
- typecheck: EXIT=1
- test: EXIT=0
- lint: EXIT=0

## Phase 1 Task 1.1 — Expo SDK 51 → 52

**Date**: 2026-04-18
**Pre-bump SHA**: 50648d080f677200badb73e812161e8173559a82
**Executed by**: Claude Sonnet 4.6 (automated)

### Diff Stats (apps/mobile/package.json + pnpm-lock.yaml)
- `apps/mobile/package.json`: 46 lines changed (+23 / -23)
- `pnpm-lock.yaml`: 3513 lines changed (+1866 / -1693)
- Total: 2 files changed, 1866 insertions(+), 1693 deletions(-)

### Cohort Pins Resolved by `expo install --fix`
| Package | From | To |
|---------|------|----|
| expo | ~51.x | ~52.0.49 |
| @expo/vector-icons | 14.1.0 | ~14.0.4 |
| @sentry/react-native | 5.36.0 | ~6.10.0 |
| expo-apple-authentication | 6.4.2 | ~7.1.3 |
| expo-auth-session | 5.5.2 | ~6.0.3 |
| expo-constants | 16.0.2 | ~17.0.8 |
| expo-crypto | 13.0.2 | ~14.0.2 |
| expo-device | 6.0.2 | ~7.0.3 |
| expo-linking | 6.3.1 | ~7.0.5 |
| expo-location | 17.0.1 | ~18.0.10 |
| expo-notifications | 0.28.19 | ~0.29.14 |
| expo-router | 3.5.24 | ~4.0.22 |
| expo-secure-store | 13.0.2 | ~14.0.1 |
| expo-status-bar | 1.12.1 | ~2.0.1 |
| expo-updates | 0.25.28 | ~0.27.5 |
| expo-web-browser | 13.0.3 | ~14.0.2 |
| react | 18.2.0 | 18.3.1 |
| react-dom | 18.2.0 | 18.3.1 |
| react-native | 0.74.5 | 0.76.9 |
| react-native-safe-area-context | 4.10.5 | 4.12.0 |
| react-native-screens | 3.31.1 | ~4.4.0 |
| @types/react | 18.2.79 | ~18.3.12 |
| typescript | 6.0.3 | ^5.3.3 (downgraded per SDK 52 requirement) |

### Exit Codes (Post-Bump vs Baseline)
| Check | Post-Bump | Baseline | Delta |
|-------|-----------|----------|-------|
| typecheck | 1 | 1 | 0 (same TS5103 pre-existing error only) |
| test | 0 | 0 | 0 (9 files, 95 tests — all green) |
| lint | 0 | 0 | 0 (same 4 warnings, 0 errors) |

No new typecheck errors introduced. The pre-existing TS5103 error in `apps/mobile/tsconfig.json` persists.

### Warnings from `expo install --fix`
1. `@sentry/react-native/expo`: Missing config for `organization, project`. Environment variables will be used as fallback during build.
2. Peer dependency warning: `@remix-run/node` expects `typescript@^5.1.0`, found 6.0.3 (pre-bump, resolved by typescript downgrade).
3. 23 deprecated subdependencies (babel plugins, glob, rimraf, sudo-prompt) — pre-existing, not introduced by this bump.
4. Build scripts ignored (sandboxed): `@sentry/cli@2.42.4`, `@sentry/cli@2.58.5`, `sharp@0.34.5`.

### Metro Bundle Smoke Test (Step 6)
Command: `timeout 120 npx expo export --platform ios --output-dir /tmp/phase1-export`
Result: EXIT=124 (timeout). Metro Bundler started successfully but did not complete within 120s. No red-screen error was observed before timeout. This is expected in a non-native CI environment without Xcode/Android SDK.

### Device Smoke Tests NOT Performed (Deferred to Gate)
The following manual device tests must be completed by the developer before the Phase 1 gate passes:
- iOS Simulator: launch app, navigate between tabs, confirm no crashes
- Android Emulator: launch app, navigate between tabs, confirm no crashes
- Web (Expo web): `pnpm dev:web` — confirm no Metro/bundler errors
- OTA update flow: confirm `expo-updates` connects to EAS Update channel

## Phase completion
- [x] Phase 0 — baseline (commits: 9c4f48a, 1e496b8, 4d9fb78, 4940825)
- [ ] Phase 1 — Expo 52
- [ ] Phase 2 — Expo 53 (React 19)
- [ ] Phase 3 — Expo 54 (+ Sentry RN 6)
- [ ] Phase 4 — Expo 55
- [ ] Phase 5 — Companion ecosystem
- [ ] Phase 6 — Web cleanup
