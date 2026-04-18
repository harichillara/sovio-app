# Expo 51 → 55 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Sovio monorepo from Expo 51 / RN 0.74.5 / React 18.2 to Expo 55 / RN 0.85.x / React 19.2, keeping web (Next 15) and mobile green at every step.

**Architecture:** Stepwise SDK upgrades (one Expo major per PR, 51→52→53→54→55). Each phase is a shippable release branch with e2e + manual QA gates. Ecosystem bumps (Sentry RN, types) land with the SDK that requires them. Web `react`/`react-dom` must bump in lockstep with mobile during Phase 2 to avoid duplicate-React footguns.

**Tech Stack:** Expo, React Native, React, Next.js 15, pnpm workspaces, TypeScript 6, EAS.

---

## Verified Current State (2026-04-18)

| Surface | File | Current pin |
|---|---|---|
| mobile `expo` | `apps/mobile/package.json:26` | `~51.0.0` |
| mobile `react-native` | `apps/mobile/package.json:42` | `0.74.5` |
| mobile `react` / `react-dom` | `apps/mobile/package.json:40-41` | `18.2.0` |
| mobile `react-native-web` | `apps/mobile/package.json:46` | `~0.19.13` |
| mobile `react-native-safe-area-context` | `apps/mobile/package.json:43` | `4.10.5` |
| mobile `react-native-screens` | `apps/mobile/package.json:44` | `3.31.1` |
| mobile `@sentry/react-native` | `apps/mobile/package.json:21` | `^5.24.0` |
| mobile `expo-router` | `apps/mobile/package.json:35` | `~3.5.0` |
| web `next` | `apps/web/package.json:17` | `^15.5.15` |
| web `react` / `react-dom` | `apps/web/package.json:18-19` | `18.2.0` |
| web `@sentry/nextjs` | `apps/web/package.json:12` | `^10.49.0` |
| `@types/react` (web, mobile) | both package.json | `~18.2.0` |
| pnpm overrides | `package.json:28-34` | tar, rollup, xmldom |

**Not installed** (verified by grep): `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets`. The Dependabot item "reanimated 3→4" is a phantom — we can skip it.

---

## File Structure

Files that will change in each phase:

- `apps/mobile/package.json` — every phase (version bumps)
- `apps/mobile/app.json` — Phases 1, 4 (plugin schema changes, New Architecture flag)
- `apps/mobile/babel.config.js` — Phase 2 (React 19 JSX transform)
- `apps/mobile/metro.config.js` — Phases 1, 4 (Metro major bumps)
- `apps/web/package.json` — Phase 2 (React 19), Phase 6 (cleanup)
- `apps/web/next.config.*` — Phase 6 (stub alias cleanup if RN 0.85 web export improves)
- `packages/ui/src/*.tsx` — Phase 2 (React 19 API removals: `defaultProps`, string refs)
- `packages/ui/src/types.ts` — Phase 2 (`@types/react` 19 ref type changes)
- `packages/core/package.json` — Phase 2 (peer dep React bump)
- `packages/tokens/package.json` — Phase 2 (peer dep React bump)
- `package.json` root — Phase 2 (add `react`/`react-dom` overrides)
- `docs/superpowers/plans/MIGRATION_LOG.md` — created in Phase 0, appended to every phase

---

## Phase 0 — Pre-flight baseline (safe, no dependency changes)

### Task 0.1: Create migration log and capture baseline

**Files:**
- Create: `docs/superpowers/plans/MIGRATION_LOG.md`
- Create: `docs/superpowers/plans/baseline/typecheck.txt`
- Create: `docs/superpowers/plans/baseline/test.txt`
- Create: `docs/superpowers/plans/baseline/lint.txt`
- Create: `docs/superpowers/plans/baseline/mobile-deps.txt`
- Create: `docs/superpowers/plans/baseline/web-deps.txt`

- [ ] **Step 1: Create release branch**

```bash
cd D:/Download/AI/Sovio
git checkout -b release/expo-55-migration
```

Expected: switched to new branch.

- [ ] **Step 2: Capture typecheck baseline**

```bash
cd D:/Download/AI/Sovio
pnpm typecheck > docs/superpowers/plans/baseline/typecheck.txt 2>&1; echo "EXIT=$?" >> docs/superpowers/plans/baseline/typecheck.txt
```

Expected: file created. `EXIT=0` preferred; if non-zero, record the current failure set as the baseline — we must not regress from it.

- [ ] **Step 3: Capture test baseline**

```bash
cd D:/Download/AI/Sovio
pnpm test > docs/superpowers/plans/baseline/test.txt 2>&1; echo "EXIT=$?" >> docs/superpowers/plans/baseline/test.txt
```

Expected: file created with full Vitest output and exit code. This is the baseline each phase must match or beat.

- [ ] **Step 4: Capture lint baseline**

```bash
cd D:/Download/AI/Sovio
pnpm lint > docs/superpowers/plans/baseline/lint.txt 2>&1; echo "EXIT=$?" >> docs/superpowers/plans/baseline/lint.txt
```

- [ ] **Step 5: Capture dependency snapshots**

```bash
cd D:/Download/AI/Sovio
pnpm --filter @sovio/mobile list --depth 0 > docs/superpowers/plans/baseline/mobile-deps.txt 2>&1
pnpm --filter @sovio/web list --depth 0 > docs/superpowers/plans/baseline/web-deps.txt 2>&1
```

- [ ] **Step 6: Write migration log header**

```markdown
# Expo 51 → 55 Migration Log

Baseline captured on `release/expo-55-migration` at commit <SHA from `git rev-parse HEAD`>.

## Baseline results
- typecheck: EXIT=<fill from typecheck.txt last line>
- test: EXIT=<fill from test.txt last line>
- lint: EXIT=<fill from lint.txt last line>

## Phase completion
- [ ] Phase 0 — baseline
- [ ] Phase 1 — Expo 52
- [ ] Phase 2 — Expo 53 (React 19)
- [ ] Phase 3 — Expo 54 (+ Sentry RN 6)
- [ ] Phase 4 — Expo 55
- [ ] Phase 5 — Companion ecosystem
- [ ] Phase 6 — Web cleanup
```

Write to `docs/superpowers/plans/MIGRATION_LOG.md`. Fill in the SHA and exit codes from the files just captured.

- [ ] **Step 7: Commit**

```bash
cd D:/Download/AI/Sovio
git add docs/superpowers/plans
git commit -m "chore(migration): capture Expo 51 baseline before upgrade

Baselines typecheck/test/lint output and dep snapshots on release/expo-55-migration
so every subsequent phase can be diffed against a known-good reference point."
```

### Task 0.2: Audit `app.json` plugins against each target SDK

**Files:**
- Create: `docs/superpowers/plans/baseline/plugin-audit.md`

- [ ] **Step 1: Research each plugin's SDK 55 compatibility**

For each plugin listed in `apps/mobile/app.json` `expo.plugins` array, consult the plugin's changelog / Expo SDK compatibility matrix via WebFetch:
- `expo-router` → docs.expo.dev/router
- `expo-secure-store` → docs.expo.dev/versions/latest/sdk/securestore
- `expo-notifications` → docs.expo.dev/versions/latest/sdk/notifications
- `expo-apple-authentication` → docs.expo.dev/versions/latest/sdk/apple-authentication
- `expo-location` → docs.expo.dev/versions/latest/sdk/location
- `@sentry/react-native/expo` → docs.sentry.io/platforms/react-native

For each plugin record: current pin → SDK 52 pin → SDK 53 pin → SDK 54 pin → SDK 55 pin, plus any plugin-config schema changes.

- [ ] **Step 2: Commit the audit**

```bash
cd D:/Download/AI/Sovio
git add docs/superpowers/plans/baseline/plugin-audit.md
git commit -m "docs(migration): plugin compatibility audit across SDK 52-55"
```

### Phase 0 gate

Before Phase 1: baseline files committed, audit committed, migration log updated with Phase 0 ☑.

---

## Phase 1 — Expo 51 → 52 (RN 0.76, React 18.3)

### Task 1.1: Bump Expo SDK and let `expo install --fix` resolve the cohort

**Files:**
- Modify: `apps/mobile/package.json` (every `expo`/`expo-*`/`react`/`react-native*` pin)
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Bump the SDK**

```bash
cd D:/Download/AI/Sovio/apps/mobile
pnpm add expo@~52.0.0
```

- [ ] **Step 2: Align the cohort**

```bash
cd D:/Download/AI/Sovio/apps/mobile
npx expo install --fix
```

Expected: `expo-*` packages, `react`, `react-native`, `react-native-web`, `react-native-safe-area-context`, `react-native-screens` are realigned to SDK 52 pins. Commit the diff unchanged.

- [ ] **Step 3: Verify typecheck still passes for mobile**

```bash
cd D:/Download/AI/Sovio
pnpm --filter @sovio/mobile exec tsc --noEmit
```

Expected: zero new errors vs `docs/superpowers/plans/baseline/typecheck.txt`.

- [ ] **Step 4: Verify unit tests pass**

```bash
cd D:/Download/AI/Sovio
pnpm test
```

Expected: same green set as baseline.

- [ ] **Step 5: Start Metro and load the bundle**

```bash
cd D:/Download/AI/Sovio
pnpm dev
```

Expected: Metro serves `index.bundle?platform=ios` without red-screen.

- [ ] **Step 6: Smoke test on device/simulator**

Manual QA checklist (record pass/fail in `MIGRATION_LOG.md`):
- Launch iOS simulator build
- Launch Android simulator build
- Launch web build via `pnpm --filter @sovio/mobile exec expo start --web`
- Auth flow (sign-in path touching `expo-auth-session`, `expo-secure-store`)
- Push token acquisition (`expo-notifications`)
- Location permission (`expo-location`)
- Tab navigation (`expo-router`)
- Sentry error report appears in dashboard after forcing a test error

- [ ] **Step 7: Commit**

```bash
cd D:/Download/AI/Sovio
git add apps/mobile/package.json pnpm-lock.yaml docs/superpowers/plans/MIGRATION_LOG.md
git commit -m "feat(mobile): upgrade to Expo SDK 52 (RN 0.76, React 18.3)

Aligned full Expo module cohort via expo install --fix.
Smoke-tested auth, push, location, routing on iOS/Android/web."
```

### Task 1.2: Handle Metro config and New Architecture flag

- [ ] **Step 1: Confirm New Architecture opt-out**

Open `apps/mobile/app.json`. Add/confirm `expo.newArchEnabled: false` top-level under `expo`. The goal is an explicit opt-out so SDK default flips don't silently enable it.

- [ ] **Step 2: Verify Metro still resolves workspace packages**

```bash
cd D:/Download/AI/Sovio/apps/mobile
npx expo start --no-dev --minify
```

Expected: bundle builds without "unable to resolve module @sovio/ui" errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Download/AI/Sovio
git add apps/mobile/app.json
git commit -m "chore(mobile): pin newArchEnabled=false during SDK 52 upgrade"
```

### Phase 1 gate

Before Phase 2: typecheck green, `pnpm test` green, manual smoke passed on iOS + Android + web. Log the pass in `MIGRATION_LOG.md` ☑ Phase 1.

---

## Phase 2 — Expo 52 → 53 (RN 0.77, React 19.0) — **HIGHEST RISK**

### Task 2.1: Coordinated React 19 bump across the whole monorepo

**Files:**
- Modify: `apps/mobile/package.json` (react, react-dom, @types/react)
- Modify: `apps/web/package.json` (react, react-dom, @types/react)
- Modify: `packages/core/package.json` (peer dep)
- Modify: `packages/tokens/package.json` (peer dep)
- Modify: `package.json` root (add overrides)
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Bump Expo SDK on mobile**

```bash
cd D:/Download/AI/Sovio/apps/mobile
pnpm add expo@~53.0.0
npx expo install --fix
```

Expected: mobile `react` flips to `19.0.x` automatically as part of the cohort.

- [ ] **Step 2: Bump web React in lockstep**

```bash
cd D:/Download/AI/Sovio/apps/web
pnpm add react@^19.0.0 react-dom@^19.0.0
pnpm add -D @types/react@^19.0.0
```

Expected: web now on React 19. `@sentry/nextjs@10` and `framer-motion@12` already support it.

- [ ] **Step 3: Add root pnpm overrides for React singletons**

Open root `package.json`. Under `pnpm.overrides`, add:

```json
"react": "$react",
"react-dom": "$react-dom"
```

(The `$name` syntax tells pnpm to dedupe to whatever the workspace asks for.) Alternatively, hardcode `"19.0.0"` / `"19.0.0"`.

- [ ] **Step 4: Bump peer deps in shared packages**

In `packages/core/package.json` and `packages/tokens/package.json`, change `"react": ">=18.0.0"` to `"react": ">=19.0.0"`.

- [ ] **Step 5: Reinstall to materialize overrides**

```bash
cd D:/Download/AI/Sovio
pnpm install
```

- [ ] **Step 6: Run typecheck**

```bash
cd D:/Download/AI/Sovio
pnpm typecheck
```

Expected failures (likely, to be fixed in Task 2.2):
- `packages/ui/src/types.ts` — ref types changed in `@types/react@19`
- Any component using `defaultProps` on function components
- Any component using string refs
- Event handler types may narrow

### Task 2.2: Fix React 19 breaking changes in `packages/ui`

**Files:**
- Modify: any file surfaced by Step 6 typecheck

- [ ] **Step 1: Search for `defaultProps` on function components**

```bash
cd D:/Download/AI/Sovio
```
Use Grep tool with pattern: `\.defaultProps\s*=` in `packages/ui/src`.

For each hit: delete the `defaultProps` assignment and move the defaults into destructuring defaults in the component signature:

```tsx
// before
function Button({ label, variant }: ButtonProps) { ... }
Button.defaultProps = { variant: 'primary' };

// after
function Button({ label, variant = 'primary' }: ButtonProps) { ... }
```

- [ ] **Step 2: Search for string refs**

Grep for `ref="` in `packages/ui/src`. For each, convert to `useRef` + callback ref.

- [ ] **Step 3: Fix ref type signatures**

In `packages/ui/src/types.ts`, any `RefObject<T>` initialised without a value — React 19 narrowed this to `RefObject<T | null>`. Update accordingly.

- [ ] **Step 4: Re-run typecheck until green**

```bash
cd D:/Download/AI/Sovio
pnpm typecheck
```

Expected: all errors resolved.

- [ ] **Step 5: Run tests**

```bash
cd D:/Download/AI/Sovio
pnpm test
```

Expected: all green.

- [ ] **Step 6: Manual QA on mobile + web**

- iOS, Android smoke of Phase 1 checklist — all still pass
- Web: `pnpm dev:web`, hit `/`, `/auth`, any tab route, confirm no red-screen and no React 19 warnings in console about `defaultProps` or `findDOMNode`

- [ ] **Step 7: Commit**

```bash
cd D:/Download/AI/Sovio
git add -A
git commit -m "feat: upgrade to Expo SDK 53 + React 19 across monorepo

- expo ~53 (RN 0.77)
- react/react-dom 19.0 on both mobile and web
- @types/react 19, removed defaultProps on function components
- root pnpm override to dedupe React to a single version
- peer deps in @sovio/core, @sovio/tokens bumped to react >=19"
```

### Phase 2 gate

Before Phase 3: typecheck green, `pnpm test` green, web build (`pnpm build`) green, manual smoke iOS/Android/web all pass. No console warnings about React 19 deprecations. Log ☑ Phase 2.

---

## Phase 3 — Expo 53 → 54 + Sentry RN 5 → 6

### Task 3.1: Bump Expo SDK 54

- [ ] **Step 1: Bump**

```bash
cd D:/Download/AI/Sovio/apps/mobile
pnpm add expo@~54.0.0
npx expo install --fix
```

- [ ] **Step 2: Typecheck + test**

```bash
cd D:/Download/AI/Sovio
pnpm typecheck && pnpm test
```

### Task 3.2: Bump `@sentry/react-native` 5 → 6

- [ ] **Step 1: Consult Sentry RN 6 migration guide**

Use WebFetch on `https://docs.sentry.io/platforms/react-native/migration/` to record breaking changes in `docs/superpowers/plans/baseline/sentry-rn-6-notes.md`.

- [ ] **Step 2: Install**

```bash
cd D:/Download/AI/Sovio/apps/mobile
pnpm add @sentry/react-native@^6.0.0
```

- [ ] **Step 3: Update init code**

Search for `Sentry.init` in `apps/mobile/app/` and `apps/mobile/index.js`. Apply any option renames from the migration doc.

- [ ] **Step 4: Verify plugin still loads**

Check `apps/mobile/app.json` `plugins` array still references `@sentry/react-native/expo` — Sentry 6 kept this path.

- [ ] **Step 5: Smoke test error capture**

Force a test throw in a tab route; confirm the event lands in the Sentry dashboard.

- [ ] **Step 6: Commit**

```bash
cd D:/Download/AI/Sovio
git add -A
git commit -m "feat(mobile): upgrade to Expo SDK 54 + Sentry RN 6"
```

### Phase 3 gate

Typecheck + tests + web build + mobile smoke + Sentry event delivery confirmed. Log ☑ Phase 3.

---

## Phase 4 — Expo 54 → 55 (RN 0.85, React 19.2)

### Task 4.1: Final SDK bump

- [ ] **Step 1: Bump**

```bash
cd D:/Download/AI/Sovio/apps/mobile
pnpm add expo@~55.0.0
npx expo install --fix
```

- [ ] **Step 2: Also bump web React to 19.2 to stay in lockstep**

```bash
cd D:/Download/AI/Sovio/apps/web
pnpm add react@^19.2.0 react-dom@^19.2.0
pnpm add -D @types/react@^19.2.0
```

- [ ] **Step 3: Consult RN 0.85 upgrade helper**

WebFetch `https://react-native-community.github.io/upgrade-helper/?from=0.81&to=0.85` (replace `from` with the pin landed by Phase 3). Apply any required native template diffs to `apps/mobile/ios/` if it exists — for a managed Expo project this is usually a no-op.

- [ ] **Step 4: Full verification matrix**

```bash
cd D:/Download/AI/Sovio
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 5: Full manual QA matrix** (same checklist as Phase 1 Step 6)

- [ ] **Step 6: Commit**

```bash
cd D:/Download/AI/Sovio
git add -A
git commit -m "feat: upgrade to Expo SDK 55 (RN 0.85, React 19.2)"
```

### Phase 4 gate

All automated checks green, full manual QA matrix passes on iOS/Android/web. Log ☑ Phase 4.

---

## Phase 5 — Companion ecosystem bumps

### Task 5.1: Reconfirm nothing was silently held back

- [ ] **Step 1: Run `pnpm outdated` for each workspace**

```bash
cd D:/Download/AI/Sovio
pnpm --filter @sovio/mobile outdated || true
pnpm --filter @sovio/web outdated || true
```

Record results in `MIGRATION_LOG.md`. For each outdated package that is a major bump, decide: defer (document why) or include in a follow-up PR (not this migration).

- [ ] **Step 2: Bump `eas-cli` if a newer patch/minor is available**

```bash
cd D:/Download/AI/Sovio/apps/mobile
pnpm add -D eas-cli@latest
```

- [ ] **Step 3: Bump `expo-atlas` if a newer SDK 55-compatible version is available**

```bash
cd D:/Download/AI/Sovio/apps/mobile
pnpm add -D expo-atlas@latest
```

- [ ] **Step 4: Commit**

```bash
cd D:/Download/AI/Sovio
git add -A
git commit -m "chore(mobile): bump eas-cli and expo-atlas alongside SDK 55"
```

### Phase 5 gate

No regressions from automated checks. Log ☑ Phase 5.

---

## Phase 6 — Web cleanup

### Task 6.1: Revisit RN stub aliases in next.config

**Files:**
- Modify: `apps/web/next.config.*`

- [ ] **Step 1: Attempt removal of `react-native$` alias**

Edit `apps/web/next.config.*`. Temporarily remove the `'react-native$'` alias line. Run:

```bash
cd D:/Download/AI/Sovio
pnpm --filter @sovio/web build
```

If it builds green: keep the removal. If it errors on Flow parsing: restore the alias and document in `MIGRATION_LOG.md` that RN 0.85 still needs the web stub.

- [ ] **Step 2: Test the full web surface**

```bash
cd D:/Download/AI/Sovio
pnpm dev:web
```

Visit key routes — any page that imports from `@sovio/core` transitively. Confirm no runtime errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Download/AI/Sovio
git add -A
git commit -m "chore(web): remove react-native stub alias now that RN 0.85 ships web-safe exports"
```

(Or `"...keep stub alias; RN 0.85 still requires web shim — documented"`.)

### Phase 6 gate

Web build + dev server both green. Log ☑ Phase 6. Migration complete.

---

## Self-review checklist

- [x] Spec coverage: Every item in the Dependabot hit list (Expo SDK, React, RN, expo-* modules) maps to Phases 1-4. Phantom "reanimated 3→4" explicitly skipped with justification.
- [x] No placeholders: Every step has a real command or concrete code change. The two research tasks (Task 0.2, Task 3.2 Step 1) explicitly require WebFetch into a recorded file rather than guessing.
- [x] Type consistency: All file paths cross-reference verified in the "Verified Current State" table at top.
- [x] Gates between phases are explicit and enforced.

---

## Known unknowns (call out early, before they bite)

- **New Architecture**: SDK 55 makes New Arch the default. We pin `newArchEnabled: false` in Phase 1 and only flip it in a separate, dedicated migration later.
- **`expo-router` v5**: Between SDK 51 (router 3.5) and SDK 55 (router 5.x) there are routing API changes. Phase 2 research task should deep-dive router migration notes.
- **iOS native project drift**: If `apps/mobile/ios/` has ever been ejected, RN 0.85 will require template diffs. If it's purely managed, `expo prebuild` handles regeneration.
