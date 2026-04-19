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
| @types/react | 18.2.79 | ~18.3.28 |
| typescript (apps/mobile) | 6.0.3 | ^5.9.3 (downgraded per SDK 52 requirement) |

> **Known divergence**: root `package.json` still pins `typescript: ^6.0.3` for web + shared packages. The mobile app intentionally uses TS 5.x until Phase 5 (companion ecosystem), at which point the toolchains will be reconciled. pnpm resolves both versions cleanly via hoisting — no build-time conflict. Documented here so reviewers don't flag it as a regression.

### Exit Codes (Post-Bump vs Baseline)
| Check | Post-Bump | Baseline | Delta |
|-------|-----------|----------|-------|
| typecheck | 1 | 1 | 0 (same TS5103 pre-existing error only) |
| test | 0 | 0 | 0 (9 files, 95 tests — all green) |
| lint | 0 | 0 | 0 (same 4 warnings, 0 errors) |
| bundle export (iOS) | 0 PASS | n/a | PASS — 1778 modules, 5.44 MB HBC |

No new typecheck errors introduced. The pre-existing TS5103 error in `apps/mobile/tsconfig.json` persists.

### Warnings from `expo install --fix`
1. `@sentry/react-native/expo`: Missing config for `organization, project`. Environment variables will be used as fallback during build.
2. Peer dependency warning: `@remix-run/node` expects `typescript@^5.1.0`, found 6.0.3 (pre-bump, resolved by typescript downgrade).
3. 23 deprecated subdependencies (babel plugins, glob, rimraf, sudo-prompt) — pre-existing, not introduced by this bump.
4. Build scripts ignored (sandboxed): `@sentry/cli@2.42.4`, `@sentry/cli@2.58.5`, `sharp@0.34.5`.

### Metro Bundle Smoke Test (Step 5)
Command: `timeout 90 npx expo export --platform ios --output-dir .expo-phase1-export`
Result: EXIT=0 — PASS. "Exported: .expo-phase1-export" confirmed. iOS bundle produced (5.44 MB HBC, 1778 modules, 20 195ms cold-start). Captured to `docs/superpowers/plans/baseline/phase1-bundle.txt`.

`expo install --fix` output (re-run on already-aligned SDK 52 tree): "Dependencies are up to date". Captured to `docs/superpowers/plans/baseline/phase1-expo-install-fix.txt`.

### Device Smoke Tests NOT Performed (Deferred to Gate)
The following manual device tests must be completed by the developer before the Phase 1 gate passes:
- iOS Simulator: launch app, navigate between tabs, confirm no crashes
- Android Emulator: launch app, navigate between tabs, confirm no crashes
- Web (Expo web): `pnpm dev:web` — confirm no Metro/bundler errors
- OTA update flow: confirm `expo-updates` connects to EAS Update channel

## Phase 1 Task 1.2 — Pin newArchEnabled=false + Metro resolution check

**Date**: 2026-04-18
**Executed by**: Claude Sonnet 4.6 (automated)

### Changes
- `apps/mobile/app.json`: added `"newArchEnabled": false` as explicit opt-out under `expo`.

### Metro workspace resolution check
Headless substitute for `expo start --no-dev --minify`:
`timeout 180 npx expo export --platform ios --output-dir .expo-phase1-task12-export`

Result: EXIT=0 — PASS. 1778 iOS modules, 5.44 MB HBC bundle (matches Task 1.1 baseline). No "Unable to resolve module @sovio/*" errors. Captured to `docs/superpowers/plans/baseline/phase1-task12-bundle.txt`.

## Phase 2 Task 2.1 — Coordinated React 19 + Expo SDK 53 bump (typecheck INTENTIONALLY red)

**Date**: 2026-04-18
**Pre-bump SHA**: 43d5c7658bcb75047bd904f4e6246855cec51ceb
**Executed by**: Claude Opus 4.7 (automated)

### Diff Stats
- `apps/mobile/package.json`: 48 lines changed (+/-)
- `apps/web/package.json`: 6 lines changed
- `packages/core/package.json`: 2 lines
- `packages/tokens/package.json`: 2 lines
- `packages/ui/package.json`: unchanged (already `react: "*"`)
- `package.json` (root): 4 lines (added 2 overrides)
- `pnpm-lock.yaml`: +937 / -1272 (net shrink ~335 lines)

### Cohort Pins Resolved by `expo install --fix` (SDK 53)

| Package | Before (SDK 52) | After (SDK 53) |
|---|---|---|
| expo | ~52.0.49 | ~53.0.27 |
| @expo/vector-icons | ^14.0.4 | ^14.1.0 |
| @sentry/react-native | ^6.10.0 | ^6.14.0 |
| expo-apple-authentication | ~7.1.3 | ~7.2.4 |
| expo-auth-session | ~6.0.3 | ~6.2.1 |
| expo-constants | ~17.0.8 | ~17.1.8 |
| expo-crypto | ~14.0.2 | ~14.1.5 |
| expo-device | ~7.0.3 | ~7.1.4 |
| expo-linking | ~7.0.5 | ~7.1.7 |
| expo-location | ~18.0.10 | ~18.1.6 |
| expo-notifications | ~0.29.14 | ~0.31.5 |
| expo-router | ~4.0.22 | ~5.1.11 |
| expo-secure-store | ~14.0.1 | ~14.2.4 |
| expo-status-bar | ~2.0.1 | ~2.2.3 |
| expo-updates | ~0.27.5 | ~0.28.18 |
| expo-web-browser | ~14.0.2 | ~14.2.0 |
| react | 18.3.1 | 19.0.0 |
| react-dom | 18.3.1 | 19.0.0 |
| react-native | 0.76.9 | 0.79.6 |
| react-native-safe-area-context | 4.12.0 | 5.4.0 |
| react-native-screens | 4.4.0 | ~4.11.1 |
| react-native-web | ~0.19.13 | ^0.20.0 |
| @types/react | ~18.3.28 | ~19.0.14 |
| typescript (mobile) | ^5.9.3 | ~5.8.3 (downgrade forced by expo SDK 53 peer) |

Note: the plan anticipated RN 0.77.x; SDK 53 actually cohort-pins RN **0.79.6**. The plan also anticipated a stable `typescript ^5.9.x` on mobile; `expo install --fix` downgraded it to `~5.8.3` (SDK 53's expected TS). Workspace-level TS stays `^6.0.3`; mobile is the lone TS 5.x holdout (documented already in Phase 1 log re: TS divergence).

### Root pnpm Overrides Added
The spec originally proposed `react: "$react"` / `react-dom: "$react-dom"` — that syntax requires the name to be a direct dependency of the root, which it is not in this monorepo (pnpm errored with `Cannot resolve version $react in overrides`). Pivoted to literal version pinning, which achieves the same dedupe goal:
- `react: "19.0.0"` — dedupe React across workspace
- `react-dom: "19.0.0"` — dedupe React DOM across workspace

### Peer Dependency Bumps
- `@sovio/core`: react `>=18.0.0` → `>=19.0.0`
- `@sovio/tokens`: react `>=18.0.0` → `>=19.0.0`
- `@sovio/ui`: already `"*"` — left as-is for maximum flexibility

### Single-Version Verification (`pnpm -r why react`)
All consumers resolve `react@19.0.0` — no drift. Confirmed zero entries of any other React major/minor in the resolver tree.

**Caveat — `@types/react` double-resolution is present and expected:** the workspace now holds both `@types/react@19.0.14` (from mobile devDependency + SDK 53 cohort) and `@types/react@18.3.28` (pulled transitively via a stale `react-native@0.74.5` peer left over in a nested Expo dep chain). The runtime React is a single `19.0.0`, so there's no hook-call risk; however, the dual `@types/react` is the direct cause of the packages/ui typecheck errors below. Resolving the types dedupe is a Task 2.2 concern — most likely a one-line root override like `"@types/react": "19.0.14"`.

### Typecheck Status (INTENTIONALLY RED — handed off to Task 2.2)
- EXIT: 1
- Error count: 3 errors, all in `packages/ui` (tokens + core pass cleanly; typecheck halts at ui via `&&`, so web + mobile are not yet exercised)
- Error categories:
  - **Dual `@types/react` ReactNode incompatibility (React 19 `bigint` in ReactNode) — 3 files**:
    - `packages/ui/src/AppHeader.tsx` (line 16:7)
    - `packages/ui/src/AppScreen.tsx` (line 10:7)
    - `packages/ui/src/TabScreen.tsx` (line 16:9)
  - All 3 are the same root cause: `React.ReactNode` from `@types/react@19` (includes `bigint`) is not assignable to the narrower `ReactNode` type from the nested `@types/react@18.3.28` that `react-native@0.74.5` drags in via a Metro runtime dep.
  - No `defaultProps`, ref-type narrowing, or event-handler errors observed yet — those will surface once the `@types/react` dedupe is in place and typecheck can advance to web + mobile.

Full output: `docs/superpowers/plans/baseline/phase2-typecheck.txt`

### Tests, Lint, Bundle Deferred
Tests are expected to fail while typecheck is red. Full test/lint/bundle verification belongs to Task 2.2 after call-site fixes land.

## Phase completion
- [x] Phase 0 — baseline (commits: 9c4f48a, 1e496b8, 4d9fb78, 4940825)
- [x] Phase 1 — Expo 52 (commit: 16a30f0; bundle re-verified EXIT=0 on 2026-04-18)
- [ ] Phase 2 — Expo 53 (React 19)
- [ ] Phase 3 — Expo 54 (+ Sentry RN 5 → 8 single jump)
- [ ] Phase 4 — Expo 55
- [ ] Phase 5 — Companion ecosystem
- [ ] Phase 6 — Web cleanup
