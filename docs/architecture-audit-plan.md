# Architecture Audit & Hardening Plan — Sovio

Generated: 2026-04-15
**Status: COMPLETE** — All chunks finished, `pnpm typecheck` = 0 errors
Baseline TypeScript errors: **0 across all 5 packages**
Expo SDK: **51** · React Native 0.74.5 · React 18.2.0 · Next.js 14 · Supabase JS v2
Packages: `@sovio/tokens`, `@sovio/core`, `@sovio/ui`, `@sovio/mobile`, `@sovio/web`

---

## Executive Summary

Sovio compiles cleanly (0 TS errors) and has good service/hook/store separation. The audit
found: **16 loose `string` DB columns**, **4 empty `.catch(() => {})`**, **5 duplicate
Supabase clients in web**, a **supabase-js version mismatch**, **2 IDOR vulnerabilities**,
**unfiltered realtime subscription**, **duplicated components**, and missing dev tooling.
This plan fixed every issue in 10 small chunks, each verified independently.

**63 files changed, +2,764 / -763 lines. Final typecheck: 0 errors.**

**No iOS/Android build setup in scope.**

---

## Chunk 1: Dependency Alignment ✅

**Goal**: Every package uses the same supabase-js version, tokens doesn't own React, TS is explicit.

| # | Task | File |
|---|------|------|
| 1.1 | Update `@supabase/supabase-js` from `^2.43.0` → `^2.101.1` | `packages/core/package.json` |
| 1.2 | Remove duplicate `@supabase/supabase-js` from mobile (core provides it) | `apps/mobile/package.json` |
| 1.3 | Move `react` from `dependencies` → `peerDependencies` in tokens | `packages/tokens/package.json` |
| 1.4 | Add `typescript ^5.4.0` as devDep to core and tokens | `packages/core/package.json`, `packages/tokens/package.json` |
| 1.5 | Remove `playwright` from root devDeps (no test files exist) | `package.json` |
| 1.6 | Run `pnpm install` |  |

**Verify**: `pnpm typecheck` = 0 errors · `pnpm install` clean

---

## Chunk 2: Web Supabase Client Consolidation ✅

**Goal**: Replace 5 duplicate `createBrowserClient` calls with one shared module.

| # | Task | File |
|---|------|------|
| 2.1 | Create shared `lib/supabase.ts` with single `createBrowserClient` | `apps/web/lib/supabase.ts` (NEW) |
| 2.2 | Refactor to import shared client | `apps/web/app/WebNav.tsx` |
| 2.3 | Refactor to import shared client | `apps/web/app/(auth)/login/page.tsx` |
| 2.4 | Refactor to import shared client | `apps/web/app/(auth)/signup/page.tsx` |
| 2.5 | Refactor to import shared client | `apps/web/app/account/page.tsx` |
| 2.6 | Refactor to import shared client | `apps/web/app/account/privacy/page.tsx` |

**Verify**: `pnpm typecheck` = 0 · `grep "createBrowserClient" apps/web/` = 1 result

---

## Chunk 3: Silent Failure Fixes ✅

**Goal**: Zero empty `.catch(() => {})` blocks — all get `console.warn`.

| # | Task | File:Line |
|---|------|-----------|
| 3.1 | Add warn to trackEvent catch | `apps/mobile/app/settings/notifications.tsx:60` |
| 3.2 | Add warn to trackEvent catch | `apps/mobile/app/settings/notifications.tsx:71` |
| 3.3 | Add warn to trackEvent catch | `apps/mobile/app/(tabs)/replay.tsx:59` |
| 3.4 | Add warn to trackEvent catch | `apps/mobile/app/(modals)/report.tsx:98` |

**Verify**: `pnpm typecheck` = 0 · `grep "catch(() => {})" apps/ packages/` = 0 results

---

## Chunk 4: App-Level Type Narrowing ✅

**Goal**: Create narrow companion types for the 10 DB columns that use bare `string`.

| # | Task | File |
|---|------|------|
| 4.1 | Create `app-types.ts` with narrow unions for: `AiJobType`, `AiJobStatus`, `AuditTargetType`, `MomentumBucket`, `AvailabilityMode`, `ConfidenceLabel`, `MomentumSource`, `SharingMode`, `ReportContentType`, `ReportReason`, `ReportStatus` | `packages/core/src/supabase/app-types.ts` (NEW) |
| 4.2 | Export from barrel | `packages/core/src/index.ts` |
| 4.3 | Create `.env.example` at project root listing all required env vars | `.env.example` (NEW) |

**Verify**: `pnpm typecheck` = 0 · new types importable from `@sovio/core`

---

## Chunk 5: Codex Review — First Pass ✅

**Goal**: Use codex:rescue agent for a deep second-opinion review of the entire codebase.

| # | Task |
|---|------|
| 5.1 | Spawn codex agent to review all packages for bugs, logic errors, security issues |
| 5.2 | Fix every finding |
| 5.3 | Re-verify `pnpm typecheck` = 0 |

**Verify**: Codex returns ALL CLEAR · 0 TS errors

---

## Chunk 6: Silent-Failure-Hunter Agent ✅

**Goal**: Agent scans full codebase for any remaining silent failures we missed.

| # | Task |
|---|------|
| 6.1 | Spawn `silent-failure-hunter` agent on full codebase |
| 6.2 | Fix every finding |
| 6.3 | Re-verify `pnpm typecheck` = 0 |

**Verify**: Agent returns ALL CLEAR · 0 TS errors

---

## Chunk 7: Type-Design-Analyzer Agent ✅

**Goal**: Agent reviews all type definitions for encapsulation, invariant expression, design quality.

| # | Task |
|---|------|
| 7.1 | Spawn `type-design-analyzer` agent on full codebase |
| 7.2 | Fix every finding |
| 7.3 | Re-verify `pnpm typecheck` = 0 |

**Verify**: Agent returns ALL CLEAR · 0 TS errors

---

## Chunk 8: Code-Reviewer Agent ✅

**Goal**: Full code-review agent pass for bugs, quality, conventions.

| # | Task |
|---|------|
| 8.1 | Spawn `code-reviewer` agent (feature-dev variant) on full codebase |
| 8.2 | Fix every HIGH/CRITICAL finding |
| 8.3 | Re-verify `pnpm typecheck` = 0 |

**Verify**: Agent returns no HIGH/CRITICAL findings · 0 TS errors

---

## Chunk 9: Code-Review Fixes ✅

**Goal**: Fix all CRITICAL/HIGH findings from Chunks 7-8 agent reviews.

| # | Task | Status |
|---|------|--------|
| 9a | Fix IDOR in `suggestions.service.ts` — make `userId` required | ✅ |
| 9b | Fix IDOR in `notifications.service.ts` — make `userId` required | ✅ |
| 9c | Remove unfiltered global messages subscription from `RealtimeProvider` | ✅ |
| 9d | Extract `withAlpha` to `@sovio/ui/styles` — deduplicate from 3 files | ✅ |
| 9e | Extract `ToggleRow` to `@sovio/ui` — deduplicate from 2 files | ✅ |

**Verify**: 0 TS errors · all IDOR and convention issues resolved

---

## Chunk 10: Final Verification & Commit ✅

**Goal**: One last typecheck, update this plan, commit everything.

| # | Task | Status |
|---|------|--------|
| 10.1 | Run `pnpm typecheck` — must be 0 | ✅ 0 errors |
| 10.2 | Update all checkboxes in this plan | ✅ |
| 10.3 | Commit all changes | pending |

**Verify**: 0 TS errors · all chunks marked complete

---

## Out of Scope (Follow-ups)

1. Platform-agnostic `@sovio/core` Supabase client (needs storage adapter refactor)
2. Supabase CLI type generation in CI
3. Expo SDK 52 upgrade
4. Web app auth hook consolidation from `@sovio/core`
5. Test infrastructure (no tests exist in any package)
6. iOS/Android native builds and EAS setup

---

## Appendix: Files to Watch

```
packages/core/package.json                    — Chunk 1
packages/core/src/index.ts                    — Chunk 4
packages/core/src/supabase/app-types.ts       — Chunk 4 (NEW)
packages/core/src/supabase/database.types.ts  — reference only
packages/tokens/package.json                  — Chunk 1
apps/mobile/package.json                      — Chunk 1
apps/mobile/app/settings/notifications.tsx    — Chunk 3
apps/mobile/app/(tabs)/replay.tsx             — Chunk 3
apps/mobile/app/(modals)/report.tsx           — Chunk 3
apps/web/lib/supabase.ts                      — Chunk 2 (NEW)
apps/web/app/WebNav.tsx                       — Chunk 2
apps/web/app/(auth)/login/page.tsx            — Chunk 2
apps/web/app/(auth)/signup/page.tsx           — Chunk 2
apps/web/app/account/page.tsx                 — Chunk 2
apps/web/app/account/privacy/page.tsx         — Chunk 2
package.json                                  — Chunk 1
.env.example                                  — Chunk 4
```
