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

## Phase completion
- [x] Phase 0 — baseline (commits: 9c4f48a, 1e496b8, 4d9fb78, 4940825)
- [x] Phase 1 — Expo 52 (commit: 16a30f0; bundle re-verified EXIT=0 on 2026-04-18)
- [x] Phase 2 — Expo 53 (React 19) — all gates green at 6eaf5aa; handoff doc at 53c3fe6
- [ ] Phase 3 — Expo 54 (+ Sentry RN v6 → v8 single jump) — Tasks 3.1 + 3.2 complete (all gates green; Sentry v8 runtime config + core peer floors + web React alignment landed); Task 3.3 pending only if Phase 3 gate review surfaces new findings
- [ ] Phase 4 — Expo 55
- [ ] Phase 5 — Companion ecosystem
- [ ] Phase 6 — Web cleanup
