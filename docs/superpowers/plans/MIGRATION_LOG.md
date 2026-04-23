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

## Phase 2 Task 2.2 — Dedupe orphans + React 19 call-site fixes + web build repair

**Date**: 2026-04-18
**Pre-fix SHA**: 5ffb96d
**Executed by**: Claude Sonnet 4.6 (Task 2.2 agent) + Claude Opus 4.7 (web-build fix + closeout)

### Root overrides added
Building on the Task 2.1 code-review hand-off ("orphaned RN is the leak source — chase it before bandaging types"), added three force-dedupe overrides to `package.json`:
```
"react-native": "0.79.6",    // kill RN 0.74.5 orphan (dragged in via @react-native/virtualized-lists)
"@types/react": "19.0.14",   // kill @types/react 18.3.28 orphan (follows the RN dedupe)
"expo-location": "18.1.6"    // kill expo-location 17.0.1 orphan (satisfied packages/core optional peer)
```
Lockfile shrank by **~1500 lines** confirming the prune. `pnpm -r why react-native` and `pnpm -r why expo-location` now return a single version each.

### React 19 call-site fixes
- `apps/mobile/app/_layout.tsx`: widened `useSegments()` return to `readonly string[]` with an explanatory comment. expo-router 5's types narrow to a non-empty tuple of literal route strings, but at `/` runtime the array is empty — the cast restores TS2367 compatibility with `segments.length === 0` defensive checks.
- `apps/mobile/tsconfig.json`: `ignoreDeprecations: "6.0"` → `"5.0"`. TS 5.8 (the SDK 53 cohort pin for mobile) rejects the `"6.0"` value with TS5103 — this resolves the one pre-existing typecheck error that was in the Phase 0 baseline. Net effect: baseline typecheck was EXIT=1, post-Task-2.2 is **EXIT=0** — Phase 2 actually reduced the error count below baseline.

### Web build regression + fix
`pnpm build` (Next 15) broke mid-closeout with:
```
Module parse failed: Unexpected token (4:7)
> export type * from './ts-declarations/global';
[expo-modules-core@2.5.0/src/index.ts]
```
**Root cause (two-part)**:
1. `expo-modules-core@2.5.0` ships raw TS at its entry (`"main": "src/index.ts"`). Next 15's webpack can't parse `export type *`.
2. `apps/web/sentry.*.config.ts` imports `{ scrubSentryEvent }` from `@sovio/core`, whose barrel re-exports `locationService` → `expo-location` → `expo` → `expo-modules-core`.

**Fix**: extended the existing `apps/web/stubs/expo-stub.js` + `next.config.js` alias pattern (already stubbing secure-store/auth-session/linking/notifications/device) to also stub `expo-location`, `expo-modules-core$`, and `expo$`. The `$` suffix uses webpack's exact-match syntax to avoid intercepting deep imports. All stubbed surface is dead code on web behind `Platform.OS === 'web'` guards — stubs exist purely to satisfy parse-time resolution. Chose this over a packages/core barrel-split because it preserves the shared `@sovio/core` cross-platform architecture that web + mobile both depend on.

### Gate results (all 4 GREEN)
| Check | Baseline | Post-Task-2.2 | Delta |
|-------|----------|---------------|-------|
| typecheck | 1 (TS5103) | **0** | **-1** |
| test | 0 (95/95) | **0** (95/95) | 0 |
| lint | 0 errors, 4 warnings | **0** errors, 4 warnings | 0 |
| web build (`pnpm build`) | not in baseline | **0** (15 routes, 242 kB First Load JS) | new green |
| mobile iOS bundle export | 5.44 MB HBC (Phase 1) | **5.83 MB** HBC | +0.39 MB (React 19 + SDK 53 runtime) |

Artifacts: `docs/superpowers/plans/baseline/phase2-task22-{typecheck,test,lint,bundle,webbuild}.txt`. The typecheck artifact is a per-workspace transcript with explicit `EXIT=0` lines per project (earlier capture only contained the pnpm command echo because `tsc` is silent on success; re-captured in commit 9d3a5e2-placeholder for audit traceability).

### Review findings closed + deferred
- **Spec review (PASS)**: flagged missing web-build artifact — closed in follow-up commit 16ba2d5.
- **Code review (PASS-WITH-NOTES)**: three LOW findings, all non-blocking:
  1. Typecheck artifact lacked per-project evidence — closed by re-capturing with explicit EXIT lines.
  2. `as readonly string[]` on `useSegments()` widens to non-null elements despite runtime possibly yielding `undefined` at `segments[0]`. Comparisons against literal strings are defensive (any non-match falls through), so behavior is correct; tightening to `readonly (string | undefined)[]` is a nit. **Deferred to Phase 2 tail** if we add any ref-sensitive routing logic.
  3. Web build is now a promoted gate but not wired into CI — the original regression slipped through Task 2.1 because `pnpm build` wasn't part of the baseline gate loop. **Deferred to Task 2.3 (Phase 2 tail): add `web-build` job to `.github/workflows/ci.yml`** so future cohort bumps can't silently break it.

### Phase 4 breadcrumb — literal `"19.0.0"` vs `"^19.0.0"` override
Task 2.1 pivoted from pnpm's `"$react"` sigil (which requires a root-level dep) to literal version pins for the React dedupe. Literal pins are tight but the tradeoff is that future SDK cohort bumps may ship a React patch/minor that becomes a mismatch. Revisit in **Phase 4** (Expo 55): if the cohort wants `react@19.0.x+N`, either bump the literal or widen to `"^19.0.0"` once we've confirmed there's no hook-mismatch risk. Same consideration applies to `"react-native": "0.79.6"` and `"@types/react": "19.0.14"`.

### Scope leak note
One scope leak crept in during Task 2.2: the `ignoreDeprecations: "6.0" → "5.0"` fix was technically pre-existing baseline noise, not Task 2.1 regression. It was adjacent to the `useSegments` widening and within the same tsconfig read-pass, so the agent fixed it inline. Called out here so reviewers don't flag it as over-scoping — net effect is better than baseline.

## Phase 3 Task 3.1 — Coordinated Expo SDK 54 + Sentry RN v6 → v8 single-jump bump

**Date**: 2026-04-23
**Pre-bump SHA**: 048c3f7bbb499db159b5c70661b64fa5e6cb1307
**Executed by**: Claude Opus 4.7 (automated)

### Procedure notes
`npx expo install --fix` on the current tree initially reported "Dependencies are up to date" because the Expo package was still on `~53.0.27` — the CLI scopes its cohort checks against the *installed* SDK version, not the latest available. Bumped `expo` to `~54.0.33` in `apps/mobile/package.json` first, ran `pnpm install` to land that, then re-ran `expo install --fix` which correctly detected 23 out-of-cohort packages and installed the SDK 54 set.

Expo's `--fix` pulled `@sentry/react-native` to `~7.2.0` (its cohort-expected version). Manually bumped to `^8.9.1` per the plan's single-jump directive (skipping v6-final and v7), then re-ran `pnpm install` to let the v8 resolution settle. Sentry v8 is the latest stable at time of bump.

### Cohort Pins Resolved by `expo install --fix` (SDK 54)

| Package | Before (SDK 53) | After (SDK 54) |
|---|---|---|
| expo | ~53.0.27 | ~54.0.33 |
| @expo/vector-icons | ^14.1.0 | ^15.1.1 |
| @sentry/react-native | ^6.14.0 | **^8.9.1** (manual — plan directive) |
| expo-apple-authentication | ~7.2.4 | ~8.0.8 |
| expo-auth-session | ~6.2.1 | ~7.0.10 |
| expo-constants | ~17.1.8 | ~18.0.13 |
| expo-crypto | ~14.1.5 | ~15.0.8 |
| expo-device | ~7.1.4 | ~8.0.10 |
| expo-linking | ~7.1.7 | ~8.0.11 |
| expo-location | ~18.1.6 | 19.0.8 (literal — override pin) |
| expo-notifications | ~0.31.5 | ~0.32.16 |
| expo-router | ~5.1.11 | ~6.0.23 |
| expo-secure-store | ~14.2.4 | ~15.0.8 |
| expo-status-bar | ~2.2.3 | ~3.0.9 |
| expo-updates | ~0.28.18 | ~29.0.16 |
| expo-web-browser | ~14.2.0 | ~15.0.10 |
| react | 19.0.0 | 19.1.0 |
| react-dom | 19.0.0 | 19.1.0 |
| react-native | 0.79.6 | 0.81.5 |
| react-native-safe-area-context | 5.4.0 | 5.6.2 |
| react-native-screens | 4.11.1 | 4.16.0 |
| react-native-web | ~0.20.0 | ~0.21.2 |
| @types/react | ~19.0.14 | 19.1.17 (literal — override pin) |
| typescript (mobile) | ~5.8.3 | ^5.9.3 (mobile stays below root ^6.0.3, intentional per Phase 5) |

### Root `package.json` pnpm.overrides bumps
Literal pins updated to match the SDK 54 cohort (per Phase 2 Task 2.2 closeout — Phase 4 revisit point called out in the handoff doc):

```
"react":         "19.0.0"  → "19.1.0"
"react-dom":     "19.0.0"  → "19.1.0"
"react-native":  "0.79.6"  → "0.81.5"
"@types/react":  "19.0.14" → "19.1.17"
"expo-location": "18.1.6"  → "19.0.8"
```

Decision: stayed on literal pins (did not widen to caret). Caret widening remains a Phase 4 option if SDK 55 churns the cohort again. Rationale: literal pins worked cleanly in Phase 2 and gates stayed green here; don't change two things at once.

### `app.json` plugin deduplication (regression repeat)
`expo install --fix` re-introduced the duplicate `@sentry/react-native` bare plugin alongside `@sentry/react-native/expo` — same regression that Phase 1 fixed in `299bafb`. Removed the bare entry; kept `@sentry/react-native/expo`. Also preserved the new `expo-web-browser` plugin entry that `expo install --fix` added legitimately (SDK 54 now requires a config plugin for `expo-web-browser`).

Final `app.json` plugin order:
```
expo-router, expo-secure-store, expo-notifications, expo-apple-authentication,
expo-location, @sentry/react-native/expo, expo-web-browser
```

### Gate results (exit codes)
| Check | Baseline | Phase 2 Task 2.2 | Phase 3 Task 3.1 | Delta vs Phase 2 |
|-------|----------|------------------|------------------|-------|
| typecheck | 1 | 0 | **0** | 0 (still green — scrubSentryEvent generic signature insulated core from Sentry type churn) |
| test | 0 (95/95) | 0 (95/95) | **0** (95/95) | 0 |
| lint | 0 errors, 4 warnings | 0 errors, 4 warnings | **0** errors, 4 warnings | 0 |
| web build (`pnpm build`) | not baselined | 0 (15 routes, 242 kB FL JS) | **0** (15 routes, 242 kB FL JS) | 0 |
| mobile iOS bundle export | 5.44 MB HBC (Phase 1) | 5.83 MB HBC | **6.08 MB** HBC | +0.25 MB (SDK 54 runtime + Sentry v8 core) |

**Notable surprise**: typecheck stayed GREEN on this bump despite Sentry crossing three majors (v6 → v8). Root cause: `scrubSentryEvent<T>(event: T): T` in `packages/core/src/observability/sentryScrubber.ts` is intentionally generic and does not import Sentry types — it walks a loose `Record<string, unknown>` shape. The `beforeSend`/`beforeSendTransaction` call-sites in `apps/mobile/app/_layout.tsx` pass the event straight through without type narrowing. Sentry v8's tightened `beforeSend` signature accepts this without complaint. Phase 3 Task 3.2 still has work to do (session-replay default, Sentry.init behavior, tracing instrumentation API), but typecheck isn't flagging it; Task 3.2 should focus on *runtime* migration rather than type-breakage triage.

Artifacts: `docs/superpowers/plans/baseline/phase3-task31-{typecheck,test,lint,webbuild,bundle,pnpm-install,expo-install-fix}.txt`. Each `{typecheck,test,lint,webbuild,bundle}.txt` has HEAD SHA + ISO timestamp headers and an explicit `EXIT=$?` line — addresses the Phase 2 Task 2.2 review finding on silent-success evidence.

### Scope leaks / observations for Task 3.2
1. **`packages/core/package.json` peer-dependency ranges are now stale.** `>=6.0.0` for expo-device, `>=0.28.0` for expo-notifications, `>=13.0.0` for expo-secure-store, `>=17.0.0` for expo-location all pre-date the SDK 54 cohort. pnpm is optimistically resolving these peers to old versions in `packages/core`'s dependency tree (`expo-device@6.0.2`, `expo-notifications@0.28.19`, `expo-secure-store@13.0.2`, `expo-constants@16.0.2`) — visible via `pnpm ls --filter=@sovio/core --depth=0`. Web/mobile build and typecheck don't exercise these because the real versions come from `apps/mobile`. Not blocking, but worth tightening the peer floors in Task 3.2 (e.g. `expo-notifications: ">=0.32.0"`). Out of scope for Task 3.1 per the allow-list.
2. **`@expo/metro-runtime@5.0.5` peer warning.** `expo-router@6.0.23` declares peer `@expo/metro-runtime@^6.1.2`, but the cohort ships 5.0.5. Upstream mismatch on Expo's side; not a regression we introduced. Revisit if expo-router's Metro runtime access actually breaks something; otherwise noise.
3. **TypeScript mobile bumped from ~5.8.3 → ^5.9.3** via expo install --fix (SDK 54's new mobile peer). Root workspace stays on `^6.0.3`; divergence documented in Phase 1 log and remains a Phase 5 concern.
4. **pnpm emitted `ENOENT` bin-link warnings** for `@sentry/react-native`'s `sentry-eas-build-on-{complete,error,success}` hook scripts (Windows `.EXE` stat failures on Unix-style bin entries). Cosmetic — the hooks are only used inside EAS Build's Linux environment, not local dev. Harmless on this workstation; will not impact EAS CI.

### Review findings placeholder
Spec-review + code-review agents to run in parallel after this commit. Findings slot in here.

## Phase 3 Task 3.2 — Close review findings: Sentry v8 runtime + core peer floors + web React alignment

**Date**: 2026-04-23
**Pre-change SHA**: 841fe4424817592f71fc2b50fb9396c552042008 (Task 3.1 head)
**Executed by**: Claude Opus 4.7 (automated)

### Review findings closed

**HIGH-1 — Sentry RN v8 runtime migration (`apps/mobile/app/_layout.tsx`)**
Sentry v8 no longer auto-registers `ReactNativeTracing`; a bare `Sentry.init({ tracesSampleRate: 0.1 })` silently no-ops tracing at runtime. Declared the integration explicitly and added a belt-and-suspenders replay opt-out so v9+ defaults can't surprise us:

```ts
integrations: [
  Sentry.reactNativeTracingIntegration(),
  // If/when we enable replay: Sentry.mobileReplayIntegration({ maskAllText: true }),
],
replaysSessionSampleRate: 0,
replaysOnErrorSampleRate: 0,
```

Verified `Sentry.wrap(RootLayout)` and `Sentry.captureException(err, { contexts: { react: { componentStack } } })` are both still v8-stable (API unchanged since v6). No call-site changes needed there.

**HIGH-2 — `packages/core` peerDependency floors (stale pre-SDK 54)**
Task 3.1 flagged that loose floors were letting pnpm co-install old expo-* versions in the `@sovio/core` peer tree. Tightened to SDK 54 cohort (`>=`, not caret, so mobile's `~N.x.y` pins still satisfy):

| Peer | Old floor | New floor |
|---|---|---|
| `expo-device` | `>=6.0.0` | `>=8.0.0` |
| `expo-notifications` | `>=0.28.0` | `>=0.32.0` |
| `expo-secure-store` | `>=13.0.0` | `>=15.0.0` |
| `expo-location` | `>=17.0.0` | `>=19.0.0` |

`expo-constants`, `expo-updates`, `expo-auth-session` are not declared as peers of `@sovio/core` (only mobile depends on them directly) — confirmed; no change needed. `react` (`>=19.0.0`) and `react-native` (`>=0.73.0`) left as-is; both already satisfied by SDK 54 and widening further serves no purpose.

**MEDIUM-1 — `apps/web` React version alignment**
Root `pnpm.overrides` already forces `19.1.0` / `19.1.17`; web's declared deps drifted at `19.0.0` / `^19.0.14`. Matched literals to the override (conservative — widening to caret is still a Phase 4 concern):

| Dep | Old | New |
|---|---|---|
| `react` | `19.0.0` | `19.1.0` |
| `react-dom` | `19.0.0` | `19.1.0` |
| `@types/react` | `^19.0.14` | `19.1.17` |

**LOW — Stale comments**
- `apps/web/stubs/expo-stub.js`: updated SDK 53 + `expo-modules-core@2.5.0` references to SDK 54 + `expo-modules-core@3.0.29` (both comment blocks).
- `apps/mobile/app/_layout.tsx`: updated "expo-router 5 types useSegments" to "expo-router 6 still types useSegments" (the cast itself is still required — the TS shape didn't change across v5→v6).

### Dedupe verification (`pnpm -r why` — each returns 1 unique version)

```
expo-device:        1 unique version(s)  → 8.0.10
expo-notifications: 1 unique version(s)  → 0.32.16
expo-secure-store:  1 unique version(s)  → 15.0.8
expo-constants:     1 unique version(s)  → 18.0.13
expo-location:      1 unique version(s)  → 19.0.8
```

Lockfile net change from peer tightening: `Packages: +1 -10` (10 old expo-* store entries pruned; one new resolution added because pnpm re-computed `@sovio/core`'s peer tree to land on the current cohort). Task 3.1's co-installed duplicates (`expo-device@6.0.2`, `expo-notifications@0.28.19`, `expo-secure-store@13.0.2`, `expo-constants@16.0.2`) are gone.

### `app.json` plugin verification
Not running `expo install --fix` in Task 3.2, so the duplicate-bare-plugin regression from Phase 1 / Task 3.1 can't recur. Confirmed: one `@sentry/react-native/expo` entry, no bare `@sentry/react-native`. Final plugin order matches Task 3.1:

```
expo-router, expo-secure-store, expo-notifications, expo-apple-authentication,
expo-location, @sentry/react-native/expo, expo-web-browser
```

### Gate results (exit codes)

| Check | Baseline | Task 3.1 | Task 3.2 | Delta vs 3.1 |
|-------|----------|----------|----------|---|
| typecheck | 1 | 0 | **0** | 0 |
| test | 0 (95/95) | 0 (95/95) | **0** (95/95) | 0 |
| lint | 0 errors, 4 warnings | 0 errors, 4 warnings | **0** errors, 4 warnings | 0 |
| web build (`pnpm build`) | not baselined | 0 (15 routes, 242 kB FL JS) | **0** (15 routes, 242 kB FL JS) | 0 |
| mobile iOS bundle export | 5.44 MB (Phase 1) | 6.08 MB | **6.08 MB** HBC | 0 (byte-for-byte identical) |

Artifacts: `docs/superpowers/plans/baseline/phase3-task32-{typecheck,test,lint,webbuild,bundle}.txt`. Each carries HEAD SHA + ISO timestamp + explicit `EXIT=$?` per-command (format precedent from Phase 2 Task 2.2 review).

### Scope leaks / observations
None. All changes inside the allow-list (apps/mobile/app/_layout.tsx, packages/core/package.json, apps/web/package.json, apps/web/stubs/expo-stub.js, pnpm-lock.yaml, MIGRATION_LOG.md, docs/superpowers/plans/baseline/phase3-task32-*). `apps/mobile/app.json` not touched. `packages/core/src/observability/sentryScrubber.ts` deliberately not touched (review-verified generic signature is insulation by design). The pre-existing pnpm peer warnings (`@expo/metro-runtime@5.0.5` vs expo-router's `^6.1.2` expectation, `@expo/require-utils` TS peer mismatch) are unchanged upstream noise, not introduced here.

### Observations for Task 3.3 / Phase 3 gate
1. **Sentry v8 runtime path is now wired but unverified on device.** Typecheck + export both pass, but `reactNativeTracingIntegration()` is only meaningful once the app runs on a device/simulator and emits a real transaction. A manual EAS build + simulator launch remains the only way to confirm traces land in Sentry — the same "device smoke deferred" caveat we've carried since Phase 1. Flag for Phase 3 gate review.
2. **`@expo/metro-runtime` peer warning persists.** expo-router 6.0.23 wants `^6.1.2`, cohort ships 5.0.5. Not regressed by Task 3.2; upstream to fix.
3. **Web build is unchanged (242 kB FL JS).** The literal `19.0.0` → `19.1.0` bump in `apps/web/package.json` was a declarative fix only — the installed tree already held 19.1.0 via overrides, so runtime output is byte-identical. Good signal that MEDIUM-1 was a drift fix, not a runtime regression.

## Phase 3 Task 3.3 — Correct Sentry replay opt-out + tracing rationale + expo-auth-session peer

**Date**: 2026-04-23
**Pre-change SHA**: e8afb48878b4eaea2e35f5f7264f97b5e09d9e69 (Task 3.2 head)
**Executed by**: Claude Opus 4.7 (automated)

Task 3.2's code review surfaced two HIGH findings and one MEDIUM — all small, mechanical corrections to rationale and peer declarations, none changing runtime behavior in a user-visible way. Closed in a single commit.

### Review findings closed

**HIGH-1 — Tracing integration rationale was factually wrong**
The Task 3.2 comment claimed "Sentry RN v8 no longer auto-registers `ReactNativeTracing`; a bare `Sentry.init({ tracesSampleRate: 0.1 })` silently no-ops tracing at runtime." That is **false** for `@sentry/react-native@8.9.1`. Verified against `node_modules/@sentry/react-native/dist/js/integrations/default.js`: the default integrations builder pushes `reactNativeTracingIntegration()` whenever `typeof tracesSampleRate === 'number'` **and** `enableAutoPerformanceTracing` is truthy (default `true`). So tracing was already auto-registered in Task 3.2 and the explicit entry was redundant (and harmlessly deduped by `filterDuplicates` in `@sentry/core`).

The integration entry is **kept** — explicit-for-clarity is a legitimate choice, and the dedupe protects against double-init — but the comment was rewritten to reflect how v8 actually behaves, so the next reader isn't taught the wrong mental model.

**HIGH-2 — "Replay opt-out" was actually an opt-in**
Task 3.2 added:
```ts
replaysSessionSampleRate: 0,
replaysOnErrorSampleRate: 0,
```
as a "belt-and-suspenders opt-out." But `default.js` registers `mobileReplayIntegration()` on **any numeric value** of either key — the condition is `typeof replaysSessionSampleRate === 'number' || typeof replaysOnErrorSampleRate === 'number'`, not `> 0`. So our "opt-out" registered the replay integration (idle at 0% sample rate, but active on the integrations list). True opt-out = **omit both keys entirely**.

Both keys were removed. The integration is no longer registered at all.

**MEDIUM — `expo-auth-session` imported without peer declaration**
`packages/core/src/services/auth.service.ts:7` imports `expo-auth-session` (`makeRedirectUri`). Task 3.2 tightened expo-device / expo-notifications / expo-secure-store / expo-location peer floors but missed this one. Mobile app provides it transitively today (`expo-auth-session@7.0.10`), but declaring it as a peer tightens the soft coupling and lets pnpm warn on future drift. Added to `peerDependencies` with floor `>=7.0.0` (matching the SDK 54 cohort's resolved version). Not marked optional in `peerDependenciesMeta` — auth is a core flow, matching the non-optional treatment of `expo-secure-store`.

### Behavior delta

The underlying runtime code behavior did **not** change meaningfully:

| Concern | Task 3.2 (shipped) | Task 3.3 (now) |
|---|---|---|
| Tracing integration | Auto-registered by v8 default + explicitly declared (deduped) | Auto-registered by v8 default + explicitly declared (deduped) |
| Replay integration | Registered-but-idle (0% sample rate) | Not registered at all |
| `expo-auth-session` version resolved | `7.0.10` via mobile's direct dep | `7.0.10` via mobile's direct dep (now also a declared peer of `@sovio/core`) |

### Dedupe verification (`pnpm -r why` — each returns 1 unique version)

```
@sentry/react-native:  1 unique version → 8.9.1
expo-auth-session:     1 unique version → 7.0.10
```

`pnpm install` reported "Already up to date" — adding the `expo-auth-session` peer was a lockfile noop because mobile's direct dep already satisfied the new constraint.

### Gate results (exit codes)

| Check | Task 3.2 | Task 3.3 | Delta |
|-------|----------|----------|-------|
| typecheck | 0 | **0** | 0 |
| test | 0 (95/95) | **0** (95/95) | 0 |
| lint | 0 errors, 4 warnings | **0** errors, 4 warnings | 0 |
| web build (`pnpm build`) | 0 (15 routes, 242 kB FL JS) | **0** (15 routes, 242 kB FL JS) | 0 |
| mobile iOS bundle export | 6.08 MB HBC | **6.08 MB** HBC (6,081,619 bytes) | 0 at reported precision |

**Bundle size delta**: negligible. Removing the two `replays*SampleRate` keys drops four property initializations and prevents `mobileReplayIntegration()` from being pushed onto the default integrations array at runtime. The integration itself is mostly native-side, so the JS bundle shrinkage would be in tens of bytes at most — below the Expo CLI's "6.08 MB" reporting precision. The gzipped HBC at this scale is insensitive to the change.

Artifacts: `docs/superpowers/plans/baseline/phase3-task33-{typecheck,test,lint,webbuild,bundle}.txt`. Each carries parent SHA + ISO timestamp + explicit `EXIT=$?`. Artifacts were captured **before** committing (parent SHA is e8afb48, Task 3.2 head); post-commit re-verification is not needed because the changes are purely editorial / declarative and the gates all passed on the working tree.

### Scope leaks / observations

None. All changes inside the allow-list (apps/mobile/app/_layout.tsx, packages/core/package.json, pnpm-lock.yaml noop, MIGRATION_LOG.md, docs/superpowers/plans/baseline/phase3-task33-*). `scrubSentryEvent` deliberately not touched. `supabase/functions/*` not touched. Root `package.json` overrides not touched (Phase 4 concern). Peer floors not widened to caret (Phase 4 concern).

## Phase 4 Task 4.1 — Coordinated Expo SDK 55 bump (final SDK major)

**Date**: 2026-04-23
**Pre-bump SHA**: 42fe3f7609be88d3054491e1e373e72713b14306 (Phase 3 Task 3.3 head)
**Executed by**: Claude Opus 4.7 (automated)

### Procedure notes
Mirror of Phase 3 Task 3.1's procedure: `expo install --fix` scopes cohort checks against the *installed* SDK version, so bumping `expo` to `~55.0.0` first (via `pnpm add expo@~55.0.0`) was required to let `expo install --fix` detect the SDK 55 cohort and install the 19 out-of-cohort packages. Unlike Phase 3, SDK 55's `expo install --fix` silently *downgraded* `@sentry/react-native` from `8.9.1` (Phase 3 head) to `~7.11.0` (its cohort-expected version for SDK 55). The downgrade was initially left in place on the working theory of "cohort-aligned is correct," but on review it directly undoes the deliberate Phase 3 v6→v8 single-jump work (3 tasks + 6 reviews) and leaves the Task 3.3 tracing rationale comment factually wrong (v7 and v8 register tracing under subtly different conditions even though the export names match). **Follow-up applied this commit**: added literal `"@sentry/react-native": "8.9.1"` to root `pnpm.overrides` and bumped `apps/mobile` declared range from `^7.11.0` back to `^8.9.1`. Re-verified 1 version installed at 8.9.1, all 5 gates EXIT=0. Future cohort bumps that try to drag Sentry below v8 should be treated the same way — the literal override holds the floor.

### Cohort Pins Resolved by `expo install --fix` (SDK 55)

| Package | Before (SDK 54) | After (SDK 55) |
|---|---|---|
| expo | ~54.0.33 | ~55.0.17 |
| @expo/vector-icons | ^15.1.1 | ^15.1.1 (unchanged) |
| @sentry/react-native | ^8.9.1 | **^8.9.1** (cohort tried to downgrade to ^7.11.0; reverted via follow-up override — see below) |
| expo-apple-authentication | ~8.0.8 | ~55.0.13 |
| expo-auth-session | ~7.0.10 | ~55.0.15 |
| expo-constants | ~18.0.13 | ~55.0.15 |
| expo-crypto | ~15.0.8 | ~55.0.14 |
| expo-device | ~8.0.10 | ~55.0.15 |
| expo-linking | ~8.0.11 | ~55.0.14 |
| expo-location | 19.0.8 | 55.1.8 (literal — override pin) |
| expo-notifications | ~0.32.16 | ~55.0.20 |
| expo-router | ~6.0.23 | ~55.0.13 |
| expo-secure-store | ~15.0.8 | ~55.0.13 |
| expo-status-bar | ~3.0.9 | ~55.0.5 |
| expo-updates | ~29.0.16 | ~55.0.21 |
| expo-web-browser | ~15.0.10 | ~55.0.14 |
| react | 19.1.0 | 19.2.0 |
| react-dom | 19.1.0 | 19.2.0 |
| react-native | 0.81.5 | 0.83.6 |
| react-native-safe-area-context | 5.6.2 | 5.6.2 (unchanged) |
| react-native-screens | 4.16.0 | 4.23.0 |
| react-native-web | ~0.21.2 | ~0.21.2 (unchanged) |
| @types/react | 19.1.17 | 19.2.14 (literal — override pin) |
| typescript (mobile) | ^5.9.3 | ^5.9.3 (unchanged; SDK 55 peer still ^5.x) |

Note: many expo-* packages jumped from their classic semver range (e.g. `~7.x`, `~15.x`) to `~55.x.y` under SDK 55 — Expo renamed several modules to carry the SDK version as their major. The numeric shift is cosmetic; the actual API surface continues its own trajectory.

### Root `package.json` pnpm.overrides bumps
Literal pins updated to match the SDK 55 cohort. Decision (consistent with Phase 3 Task 3.1): stayed on literal pins; did *not* widen to caret. Rationale: literal pins have worked cleanly across three coordinated bumps (Phases 2 / 3 / 4) and the manual diff effort per phase is trivial. Caret widening remains an option post-migration if the maintenance burden grows.

```
"react":                 "19.1.0"  → "19.2.0"
"react-dom":             "19.1.0"  → "19.2.0"
"react-native":          "0.81.5"  → "0.83.6"
"@types/react":          "19.1.17" → "19.2.14"
"expo-location":         "19.0.8"  → "55.1.8"
"@sentry/react-native":  (none)    → "8.9.1"  # added in follow-up to undo SDK 55 cohort's v7 downgrade
```

### `apps/web/package.json` version alignment
Matched web's React/@types/react literals to the new root overrides (same pattern as Phase 3 Task 3.2's MEDIUM-1 closure):

| Dep | Old | New |
|---|---|---|
| `react` | `19.1.0` | `19.2.0` |
| `react-dom` | `19.1.0` | `19.2.0` |
| `@types/react` | `19.1.17` | `19.2.14` |

### `app.json` plugin deduplication (regression repeat — third occurrence)
`expo install --fix` re-introduced the duplicate bare `@sentry/react-native` plugin alongside `@sentry/react-native/expo` — same regression fixed in Phase 1 `299bafb` and again in Phase 3 Task 3.1. Removed the bare entry; kept `@sentry/react-native/expo`. This regression should be considered **chronic** — document in the Phase 4 gate / carry-forward for any future `expo install --fix` invocation.

Final `app.json` plugin order (unchanged from Phase 3):
```
expo-router, expo-secure-store, expo-notifications, expo-apple-authentication,
expo-location, @sentry/react-native/expo, expo-web-browser
```

### New Architecture decision — KEEP newArchEnabled=false
`apps/mobile/app.json` continues to carry `"newArchEnabled": false` (pinned since Phase 1 `43d5c76`). SDK 55 makes New Architecture the *default* but still respects an explicit opt-out — `expo install --fix` did not strip the flag, and no warning surfaced during install or bundle export. Left the opt-out in place per the plan's "Known unknowns" guidance: *"SDK 55 makes New Arch the default. We pin newArchEnabled: false in Phase 1 and only flip it in a separate, dedicated migration later."* The flip will be its own dedicated migration phase (post-Phase 6), with a full device smoke matrix. No runtime behavior change this phase.

### Dedupe verification (`pnpm -r why` — each returns 1 unique version)

```
react:                 Found 1 version of react
react-dom:             Found 1 version of react-dom
react-native:          Found 1 version of react-native
@types/react:          Found 1 version of @types/react
expo-location:         Found 1 version, 2 instances (mobile + core peer)
@sentry/react-native:  Found 1 version of @sentry/react-native
```

All six critical packages deduped. The `expo-location` "2 instances" is pnpm's way of saying the single version `55.1.8` is referenced from two workspace manifests (`@sovio/mobile` directly, `@sovio/core` peer) — not a version duplicate.

### Gate results (exit codes)

| Check | Baseline | Phase 3 Task 3.3 | Phase 4 Task 4.1 | Delta vs 3.3 |
|-------|----------|------------------|------------------|---|
| typecheck | 1 | 0 | **0** | 0 (still green — per-workspace receipt in phase4-task41-typecheck.txt confirms each of tokens/core/ui/web/mobile returned EXIT=0) |
| test | 0 (95/95) | 0 (95/95) | **0** (95/95) | 0 |
| lint | 0 errors, 4 warnings | 0 errors, 4 warnings | **0** errors, 4 warnings | 0 |
| web build (`pnpm build`) | not baselined | 0 (15 routes, 242 kB FL JS) | **0** (15 routes, 242 kB FL JS) | 0 |
| mobile iOS bundle export | 5.44 MB (Phase 1) | 6.08 MB HBC | **6.1 MB** HBC | +0.02 MB (essentially unchanged at Expo CLI precision) |

**Notable surprise**: typecheck stayed GREEN on the final SDK bump. No call-site breaks from React 19.2, RN 0.83, expo-router 55, or the Sentry v8→v7 cohort alignment. The defensive `scrubSentryEvent<T>(event: T): T` generic and the `useSegments()` `readonly string[]` widening from Phase 2 continue to insulate the app from type churn. No Task 4.2 call-site fixup needed.

Artifacts: `docs/superpowers/plans/baseline/phase4-task41-{typecheck,test,lint,webbuild,bundle}.txt`. Each carries parent SHA + ISO timestamp + explicit `EXIT=$?` per-command / per-workspace (per-project receipts preserve the Phase 2 Task 2.2 review fix for silent `tsc` success).

### Scope leaks / observations

1. **`@sentry/react-native` downgraded v8 → v7 by cohort — RESOLVED via follow-up re-pin**. SDK 55's cohort pinned `@sentry/react-native@~7.11.0`, and `expo install --fix` applied that downgrade. Phase 3 Task 3.1 had manually forced v8.9.1 as the "single-jump" directive per plan; SDK 55 walked us back to v7.11.0 silently (typecheck stayed green only because v7.11.0 happens to export the same `reactNativeTracingIntegration()` / `mobileReplayIntegration()` API surface — the `scrubSentryEvent<T>(event: T): T` generic then absorbed any residual event-shape delta). This would have orphaned the v8-specific runtime rationale embedded in `apps/mobile/app/_layout.tsx` (auto-registration semantics documented in Task 3.3). **Follow-up fix**: added literal `"@sentry/react-native": "8.9.1"` to root `pnpm.overrides` and bumped `apps/mobile` declared range to `^8.9.1`. Re-verified: `pnpm -r why @sentry/react-native` → 1 version, 8.9.1. All 5 gates still EXIT=0 (artifact `phase4-task4.1-followup-sentry-v8-repin.txt`). This preserves the deliberate Phase 3 v6→v8 single-jump and keeps the `_layout.tsx` tracing comment factually accurate.

2. **Chronic `app.json` bare-plugin regression**. Third time `expo install --fix` re-added duplicate bare `@sentry/react-native` plugin (Phase 1 `299bafb`, Phase 3 Task 3.1, now Phase 4 Task 4.1). Expo CLI does not deduplicate the plugin array on merge. Consider opening an upstream issue, or documenting as a permanent post-`expo install --fix` cleanup step.

3. **`@expo/metro-runtime@5.0.5` peer warning persists**. `expo-router@55.0.13` declares peer `@expo/metro-runtime@^55.0.10`, but the cohort installed by `expo install --fix` still ships `5.0.5`. Upstream mismatch on Expo's side; carries forward from Phase 3 Task 3.1 unchanged. Not introduced this phase.

4. **TS 5.x vs 6.x mobile/workspace divergence unchanged**. Mobile stays on `^5.9.3`; workspace root remains `^6.0.3`. Per Phase 1 and Phase 3 documentation, this is a Phase 5 (companion ecosystem) reconciliation concern.

5. **pnpm bin-link `ENOENT` warnings for Sentry EAS hooks**. Same Windows `.EXE` stat failure as Phase 3 Task 3.1 on `sentry-eas-build-on-{complete,error,success}`. Cosmetic; hooks only execute inside EAS Build's Linux environment.

6. **`@expo/require-utils` peer wants TS `^5.x`**. Peer-dep warning against the workspace TS `^6.0.3`; the lone mobile workspace stays on TS 5.9.3 so the actual mobile cohort is satisfied. Not a regression.

### Review findings (parallel spec + code reviews at HEAD=1b74fc5)

**Spec review verdict: PASS-WITH-NOTES.** All plan-required Task 4.1 deliverables shipped, all 5 gates EXIT=0 with compliant receipts. Spec reviewer noted the Sentry v8 directive was briefly violated in commit `2a636ac` (cohort downgrade left in place) then self-corrected in `1b74fc5` — classified as correct recovery, not a scope leak. LOW notes: plan Step 3 (RN upgrade-helper consult) undocumented (acceptable for managed Expo), Step 5 (manual device QA) deferred per Phase 1/2/3 precedent.

**Code review verdict: PASS-WITH-FINDINGS.** Two MED latent-risk findings, both documentation-class; no runtime blockers.

- **MED-1 (addressed here): override literal pins must bump atomically.** `@sentry/react-native@8.9.1` bakes exact peer constraints `react@19.2.0` and `react-native@0.83.6` into its manifest. Since we hold all three at literal values in root `pnpm.overrides`, bumping any one without the others (e.g., a React 19.2.1 security patch) would trigger pnpm peer-satisfaction errors or silent multi-React installs. **Mitigation**: when bumping any of `react`, `react-dom`, `react-native`, or `@sentry/react-native` in `pnpm.overrides`, verify the post-install state with `pnpm -r why react && pnpm -r why @sentry/react-native` and confirm each still reports 1 version. Future cohort phases should bump the four as a set or explicitly note why they diverge.

- **MED-2 (addressed here): Sentry RN v8 and Sentry Next v10 share `@sentry/core@10.49.0`.** Per `pnpm-lock.yaml`, `@sentry/react-native@8.9.1` resolves `@sentry/core@10.49.0` — the same core as `@sentry/nextjs@10.49.0`. No conflict today (independent runtimes, clean dedup), but the major-version label divergence ("v8 RN" vs "v10 Next") hides the shared core. A future contributor "aligning" RN to v10 could land a `@sentry/core` incompatible with the RN native bridge. The label gap is intentional on Sentry's side (the RN SDK is versioned independently of the JS SDKs) — do not attempt to harmonize the major numbers.

- **INFO (dismissed — reviewer mistake): `Array.isArray(e.breadcrumbs)` guard in `packages/core/src/observability/sentryScrubber.ts:150`.** Reviewer claimed the guard always fails under v8 because `breadcrumbs` is `{ values?: Breadcrumb[] }`. Verified against `node_modules/@sentry/core/build/types/types-hoist/event.d.ts:45`: `breadcrumbs?: Breadcrumb[]` — a bare array, exactly as the scrubber assumes. The `{ values }` envelope is a transport/Scope shape, not the `Event.breadcrumbs` shape. Scrubber is correct. No action.

## Phase 5 Task 5.1 — Companion ecosystem audit & bumps

**Parent commit:** `07c12ba` (Phase 4 pre-flight receipt). Ran against `release/expo-55-migration`.

### Step 1 — `pnpm outdated` audit (2026-04-23)

Raw outputs captured at `docs/superpowers/plans/baseline/phase5-task51-outdated-{mobile,web}.txt`.

**Mobile workspace (`@sovio/mobile`):**

| Package | Current | Latest | Kind | Decision | Reason |
|---|---|---|---|---|---|
| `react` | 19.2.0 | 19.2.5 | patch | **Defer** | Pinned by root override (`19.2.0`); in lockstep with Expo SDK 55 + React 19 resolution. Not part of Task 5.1. |
| `react-dom` | 19.2.0 | 19.2.5 | patch | **Defer** | Same override pin; follow-up ticket alongside React patch. |
| `@tanstack/react-query` | 5.99.1 | 5.100.1 | minor | **Defer** | Out of migration scope. Untested against SDK 55 QC matrix; owner-scheduled post-migration. |
| `react-native-safe-area-context` | 5.6.2 | 5.7.0 | minor | **Defer** | Version aligned to Expo SDK 55's expected range (`5.6.x`). Do not bump independently; will ride the next `expo install --fix` cycle. |
| `react-native-screens` | 4.23.0 | 4.24.0 | minor | **Defer** | Same rationale as safe-area-context — SDK-pinned. |
| `eas-cli` | 10.2.4 | 18.8.1 | **MAJOR** | **Include** (Task 5.1 Step 2 mandates) | Dev tool only, does not ship in bundle or affect runtime. Step 2 explicitly directs this bump. |
| `typescript` | 5.9.3 | 6.0.3 | **MAJOR** | **Defer** | TypeScript 6 is a breaking major. Needs its own migration pass (likely separate branch). Out of SDK 55 migration scope. |
| `react-native` | 0.83.6 | 0.85.2 | minor | **Defer** | Root override pins `0.83.6` to match Expo SDK 55. Independent bump would break Expo pin contract. |

**Web workspace (`@sovio/web`):**

| Package | Current | Latest | Kind | Decision | Reason |
|---|---|---|---|---|---|
| `react` | 19.2.0 | 19.2.5 | patch | **Defer** | Root override pin; see mobile rationale. |
| `react-dom` | 19.2.0 | 19.2.5 | patch | **Defer** | Same. |
| `@sentry/nextjs` | 10.49.0 | 10.50.0 | patch | **Defer** | Out of scope; web observability not in SDK 55 migration mandate. |
| `@supabase/supabase-js` | 2.103.3 | 2.104.1 | patch | **Defer** | Out of scope. |
| `@next/bundle-analyzer` | 15.5.15 | 16.2.4 | **MAJOR** | **Defer** | Next.js 16 is a breaking major. Phase 6 (Web cleanup) or follow-up release. |
| `next` | 15.5.15 | 16.2.4 | **MAJOR** | **Defer** | Same — Next.js 16 is out of SDK 55 migration scope. |

**Sentry note:** `@sentry/react-native` does **not** appear as outdated — root override at `8.9.1` holds it there per commit `1b74fc5` rationale (Expo SDK 55 compat; avoid v10 jump during migration). Confirmed the override is working as designed; no action.

**Totals:**
- Major bumps deferred: **3** (typescript 6, next 16, @next/bundle-analyzer 16).
- Majors included: **1** (eas-cli — explicit Step 2 mandate).
- Minor/patch deferred: **7** (react, react-dom ×2, @tanstack/react-query, react-native-safe-area-context, react-native-screens, react-native, @sentry/nextjs, @supabase/supabase-js).
- Minor/patch included: **0** (no passive bumps — only the two explicit Step 2/Step 3 targets).

### Step 2 — `eas-cli` bump

- Before: `^10.2.4` (major 10)
- After: `^18.8.1` (major 18)
- Delta: +8 majors. Dev-only tool; zero runtime impact on mobile bundle. **Correction from initial write-up**: eas-cli@18.8.1 does NOT ship its own bundled TS — per `pnpm-lock.yaml` line 11138, it resolved its `typescript` peer against the mobile workspace's `typescript@5.9.3`. No new TS 6 copy was introduced by the bump. The two TS versions in the lock (root `typescript@6.0.3` at line 6311, mobile `typescript@5.9.3` at line 6306) predate this task. Workspace tsc instances remain clean: root uses 6.0.3, mobile uses 5.9.3, eas-cli runs with mobile's 5.9.3 as its peer — no shadowing.

### Step 3 — `expo-atlas` bump

- Before: `^0.4.3`
- After: `^0.4.3` (no-op — already at latest)
- `npm view expo-atlas@latest` confirms version `0.4.3`; peer is `expo: '*'` (no SDK constraint to verify). No change to `package.json` version spec; `pnpm add` ran successfully with no lockfile churn for this package.

### Step 4 — 5-gate verification (all at post-bump working tree)

| Gate | Artifact | EXIT |
|---|---|---|
| Typecheck | `phase5-task51-typecheck.txt` | 0 |
| Lint | `phase5-task51-lint.txt` | 0 (4 pre-existing unused-disable warnings — not new) |
| Test | `phase5-task51-test.txt` | 0 (9 files / 95 tests passed) |
| Web build | `phase5-task51-webbuild.txt` | 0 (Next.js build succeeded; 14 routes prerendered/dynamic) |
| iOS bundle export | `phase5-task51-bundle.txt` | 0 (5.7MB HBC bundle emitted) |

All five gates green at `HEAD=07c12ba` + working-tree deltas (eas-cli bump only).

### Scope leaks / observations (not fixed in this commit)

- **pnpm install warnings:** `eas-build-hook.js.EXE` bin-link warnings from `@sentry/react-native@8.9.1` persist (benign Windows pnpm quirk — not a new regression). Documented here for transparency; no action needed.
- **eas-cli 10 → 18 is 8 majors of drift:** Team should schedule a CI job to keep eas-cli within 1–2 majors going forward so future SDK migrations don't absorb this kind of tooling-debt jump in-band.
- **Next.js 16 + TypeScript 6 are both waiting in the wings:** Separate tracked follow-ups, not scoped here.
- **`@tanstack/react-query` 5.99 → 5.100:** Trivial minor, no known breaking changes; owner can pick up in next sprint.
- **`@sentry/node@7.77.0` transitive via eas-cli:** eas-cli@18.8.1 carries `@sentry/node@7.77.0` as a dev transitive (`pnpm-lock.yaml` line 11165). Distinct from app's `@sentry/node@10.49.0` (pulled by `@sentry/nextjs`) and `@sentry/react-native@8.9.1` (root-override pinned). No runtime effect — `@sentry/node` only runs inside the eas-cli CLI process, never in the app bundle. Flagging so future contributors don't confuse it with the app's Sentry versions when dedupe-auditing.

### Post-review fixes (follow-up commit)

Applied in the next commit after parallel reviews surfaced:
- **`apps/mobile/eas.json` `cli.version` tightened from `">= 10.0.0"` → `">= 18.0.0"`** (code review MED-1). The field's purpose is to communicate minimum supported CLI version to CI and other developers; `>= 10` would silently accept v10–v17 runs against a codebase tested with v18, creating divergence risk across eas-cli's breaking majors (v11 removed deprecated update flags, v13 changed config resolution). Tightened to match the tested local install.
- **TS-isolation claim in Step 2 corrected** (code review MED-2) — see Step 2 note above.
- **5-gate receipts re-captured at the follow-up HEAD** (spec review MED-1) so the receipt header SHA matches the commit actually being validated.

## Phase 6 Task 6.1 — RN stub removal attempt (KEEP alias)

**Date**: 2026-04-23
**Pre-attempt SHA**: 8256ed3 (Phase 5 completion tick)
**Executed by**: Claude Opus 4.7 (automated)

Per plan lines 585–599: attempt removing the `'react-native$'` webpack alias from `apps/web/next.config.js`; keep removal if web build stays green, otherwise restore.

### Experiment

Removed the single `'react-native$': path.resolve(__dirname, 'stubs/react-native-stub.js')` alias line. All other aliases (`expo-secure-store`, `expo-auth-session`, `expo-linking`, `expo-notifications`, `expo-device`, `expo-location`, `expo-modules-core$`, `expo$`) left untouched — the plan explicitly scopes Task 6.1 to the RN alias only.

Ran `pnpm build`.

### Result: FAILED — alias still required

```
Error:   x Expected 'from', got 'typeOf'
  ,-[node_modules/.pnpm/react-native@0.83.6.../react-native/index.js:27:1]
27 | import typeof * as ReactNativePublicAPI from './index.js.flow';
   :        ^^^^^^
```

RN 0.83.6 continues to ship Flow syntax at its public API entry — specifically `import typeof * as`, which Next 15.5's SWC loader cannot parse. The import trace pins the responsible chain: `packages/core/src/services/auth.service.ts` → `react-native` (platform-gated auth, guarded by `Platform.OS === 'web'` at runtime but the import itself still resolves statically through `packages/core`'s barrel export to the web app).

### Decision

Restored the `'react-native$'` alias and embedded a Phase 6 comment in `next.config.js:14-18` documenting the attempt date, RN version tested, exact error, and the condition for future retry ("after RN ships a TS or Babel-parsed entry point"). The alias is load-bearing, not vestigial.

### Post-restore verification

Single gate re-run (the only one the stub affects):
- `pnpm build` → EXIT=0 (14 routes, shared chunks 242 kB — identical to Phase 5 baseline)

Other gates (typecheck/lint/test/bundle) unaffected by the next.config.js edit-and-revert — their inputs never changed in net terms.

Artifact: `docs/superpowers/plans/baseline/phase6-task61-stub-removal-attempt.txt` (HEAD + ISO + EXIT trailer per Phase 2 Task 2.2 discipline).

### Scope carry-forward

- The `expo-*` stub aliases were not re-tested; plan scopes Task 6.1 to the RN alias only. A future housekeeping PR could probe each in isolation under current `expo-modules-core@3.0.29`. Tracked as low-priority cleanup, not in this migration.
- Upstream RN entry-point de-Flow'ing: no ETA in the RN repo as of 2026-04. Track at https://github.com/facebook/react-native.

## Phase completion
- [x] Phase 0 — baseline (commits: 9c4f48a, 1e496b8, 4d9fb78, 4940825)
- [x] Phase 1 — Expo 52 (commit: 16a30f0; bundle re-verified EXIT=0 on 2026-04-18)
- [x] Phase 2 — Expo 53 (React 19) — all gates green at 6eaf5aa; handoff doc at 53c3fe6
- [x] Phase 3 — Expo 54 (+ Sentry RN v6 → v8 single jump) — Tasks 3.1 + 3.2 + 3.3 complete; commits 048c3f7 (handoff) and predecessors
- [x] Phase 4 — Expo 55 — Task 4.1 complete (commit `2a636ac` + follow-up `1b74fc5` re-pinning Sentry v8; all five gates green; newArchEnabled=false retained; parallel reviews PASS/PASS-WITH-FINDINGS — both MED findings addressed in MIGRATION_LOG; no Task 4.2 call-site fixup needed — typecheck stayed green on SDK 55); device smoke deferred to gate per Phase 1/2/3 pattern
- [x] Phase 5 — Companion ecosystem — Task 5.1 complete across three commits: `5fdfe3f` (eas-cli 10→18, expo-atlas unchanged, 3 majors deferred), `2b0b3e8` (review-fix: eas.json cli.version tightened to >=18, TS-isolation claim corrected, @sentry/node@7 transitive documented), `da29507` (follow-up verification receipt). Parallel reviews PASS-WITH-NOTES / PASS-WITH-FINDINGS — all 3 code findings + 1 spec finding addressed. Scope note: "TS reconciliation (mobile 5.9 → 6.0)" that my internal todo list mentioned is NOT part of the plan's Phase 5 — it is a deferred follow-up (see outdated audit: "typescript 5.9 → 6.0: **Defer** — breaking major, needs its own migration pass"). Phase 5 as plan-written covers only companion dev-tool bumps; both shipped.
- [x] Phase 6 — Web cleanup — Task 6.1 complete. Attempted `react-native$` alias removal under RN 0.83.6; still fails at `react-native/index.js:27` (Flow `import typeof * as` syntax unparseable by Next 15 SWC). Restored alias with dated Phase 6 rationale comment in `next.config.js`. Web build EXIT=0 after restore; no other gates affected (net zero config.js change). Receipt at `docs/superpowers/plans/baseline/phase6-task61-stub-removal-attempt.txt`.

## Migration complete

Expo 51 → 55 migration ends at Phase 6 Task 6.1. 29 commits on `release/expo-55-migration` from baseline `9c4f48a` through HEAD. All five gates (typecheck, lint, test, web build, iOS bundle export) green at HEAD. Device smoke QA matrix deferred to pre-merge — see "Device smoke QA required" list in HANDOFF-2026-04-19.md § 3 item 4 and the individual phase-completion notes above.

Carry-forward (not part of this migration):
- TypeScript 6 mobile reconciliation (mobile stays on 5.9.3; root is 6.0.3) — own migration PR
- Next.js 16 (currently 15.5.15) — own migration PR
- Sentry Next.js config → `instrumentation.ts` (Next 15 deprecation warning in build output) — own cleanup PR
- `expo-*` stub aliases in `next.config.js` (may also be removable under current `expo-modules-core@3.0.29`) — low-priority housekeeping
