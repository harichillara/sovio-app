# Codebase Concerns

**Analysis Date:** 2026-04-15

## Security Considerations

**[CRITICAL] Billing webhook has no Stripe signature verification:**
- Risk: When `STRIPE_READY` is flipped to `true`, the billing webhook will parse and trust raw JSON from any caller without verifying the Stripe signature. The TODO comment on line 49 confirms this is known but unfixed.
- Files: `supabase/functions/billing-webhook/index.ts` (lines 49-53)
- Current mitigation: `STRIPE_READY = false` -- the live path is dormant.
- Recommendation: Implement `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` before changing `STRIPE_READY`. Add a pre-launch checklist gate. An attacker could POST forged events and grant themselves pro access the moment the flag flips.

**[CRITICAL] ai-generate Edge Function has no authentication on user-facing ops:**
- Risk: The `ai-generate` function dispatches operations (intent, reply_draft, replay, weekly_insight, decision_proposal) based on `body.op` but never validates the caller's JWT. Any caller with the Supabase anon key can invoke `intent` or `decision_proposal` for any userId.
- Files: `supabase/functions/ai-generate/index.ts` (lines 546-607)
- Current mitigation: None. Contrast with `supabase/functions/intent-refresh/index.ts` which properly calls `authenticateRequest()` (line 701).
- Recommendation: Add JWT verification for user-facing ops. The cron ops (called via pg_net with service role) should verify the service role key.

**[HIGH] matchmaker Edge Function has no authentication:**
- Risk: The `matchmaker` function accepts `userId` from the request body with no JWT verification. Any caller could trigger a match as any user, creating plans and threads on their behalf.
- Files: `supabase/functions/matchmaker/index.ts` (lines 10-178)
- Current mitigation: None.
- Recommendation: Verify JWT and ensure `userId` matches `auth.uid()`.

**[HIGH] moderation Edge Function has no authentication:**
- Risk: The `moderation` function accepts requests without verifying any token. It writes to `audit_log` and `app_events` using caller-supplied `userId`.
- Files: `supabase/functions/moderation/index.ts` (lines 59-113)
- Current mitigation: None.
- Recommendation: Require either a user JWT or service role key.

**[HIGH] CORS wildcard on all Edge Functions:**
- Risk: Every Edge Function sets `Access-Control-Allow-Origin: '*'`, allowing any origin to call these endpoints. While the anon key is public, this still removes a defense-in-depth layer.
- Files: `supabase/functions/billing-webhook/index.ts` (line 21), `supabase/functions/ai-generate/index.ts` (line 538), `supabase/functions/intent-refresh/index.ts` (line 691), `supabase/functions/matchmaker/index.ts` (line 12), `supabase/functions/moderation/index.ts` (line 61), `supabase/functions/notify/index.ts` (line 90)
- Current mitigation: None.
- Recommendation: Restrict to the app's actual origins. The billing webhook should accept only Stripe IPs and should not have CORS at all (webhooks are server-to-server).

**[HIGH] Moderation Edge Function fails open:**
- Risk: When Gemini moderation throws an error (network, quota, etc.), the Edge Function returns `{ safe: true }`, allowing potentially harmful content through. This contradicts the client-side `GeminiClient.moderate()` which correctly fails closed (returns `flagged: true`).
- Files: `supabase/functions/moderation/index.ts` (line 53-56), `packages/core/src/ai/gemini-client.ts` (lines 131-141)
- Current mitigation: None.
- Recommendation: Flip the server-side default to `{ safe: false }` (fail closed), matching the client behavior.

**[MEDIUM] `getSuggestedPlans` exposes plans without access check:**
- Risk: The function queries all active plans not created by the user, returning full `*` columns. No RLS policy or friendship check limits which plans are visible.
- Files: `packages/core/src/services/plans.service.ts` (lines 113-123)
- Current mitigation: RLS (if configured for the `plans` table -- no RLS migration visible for plans).
- Recommendation: Add RLS policies on the `plans` table, or scope the query to friends-of-friends / public plans.

**[MEDIUM] Gemini API key passed in URL query string:**
- Risk: Both the client `GeminiClient` and the Edge Functions pass the Gemini API key as a `?key=` URL parameter. This means the key appears in server access logs, CDN logs, and possibly browser history on web.
- Files: `packages/core/src/ai/gemini-client.ts` (lines 29, 62), `supabase/functions/ai-generate/index.ts` (line 19), `supabase/functions/intent-refresh/index.ts` (line 65), `supabase/functions/moderation/index.ts` (line 38)
- Current mitigation: Google's API requires this pattern, so server-side usage is acceptable. Client-side usage from the mobile app is more concerning if the key is ever exposed.
- Recommendation: Keep Gemini calls server-side (Edge Functions only). Ensure the client never gets a Gemini API key in production.

**[MEDIUM] `useIsPro` has inconsistent pro-check logic vs. `billing.service.ts`:**
- Risk: `useIsPro()` in `packages/core/src/hooks/useEntitlements.ts` (line 34) checks `new Date(data.pro_until) > new Date()` with no clock-skew grace period. Meanwhile `hasActiveProAccess()` in `packages/core/src/services/billing.service.ts` (line 42) applies a 5-minute `CLOCK_SKEW_GRACE_MS`. Users could see inconsistent pro/free state depending on which code path checks their status.
- Files: `packages/core/src/hooks/useEntitlements.ts` (lines 29-35), `packages/core/src/services/billing.service.ts` (lines 36-43)
- Recommendation: Use a single `isProActive()` helper everywhere.

## Tech Debt

**[HIGH] TypeScript build is broken:**
- Issue: `pnpm typecheck` fails on `packages/core/src/services/momentum.service.ts` line 187. A type assertion for the legacy `{ bucket, expires_at }` fallback schema is missing the required `available_until` property.
- Files: `packages/core/src/services/momentum.service.ts` (line 187), `typecheck-output.txt`
- Impact: The project cannot pass type-checking, which means there is no CI gate on type safety.
- Fix approach: Cast through `unknown` or add `available_until` to the fallback payload.

**[HIGH] No linter, no formatter, no CI/CD:**
- Issue: No `.eslintrc`, `.prettierrc`, `biome.json`, or CI configuration files exist in the repository. No `.github/workflows/` directory. No linting or formatting is enforced.
- Files: (absent -- no linting/formatting config anywhere)
- Impact: Code style drifts over time. Type errors, unused imports, and potential bugs go undetected. No automated gates before merging.
- Fix approach: Add ESLint + Prettier (or Biome) with workspace-level config. Add a GitHub Actions workflow for lint, typecheck, and (eventually) tests.

**[HIGH] Zero test files in the project:**
- Issue: There are no `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files anywhere outside `node_modules`. No test framework is configured (no jest.config, vitest.config, etc.).
- Files: (absent)
- Impact: Every service, hook, and Edge Function is untested. Regressions are only caught by manual QA.
- Fix approach: Add Vitest. Prioritize testing services (pure functions with DB calls can be mocked) and the AI prompt/parse logic which is fragile.

**[HIGH] Dual schema support creates pervasive complexity:**
- Issue: Multiple services maintain "extended schema" vs "legacy fallback" code paths, doing trial queries to detect which columns exist. This adds significant complexity and makes every operation do 2-3x the database round trips.
- Files: `packages/core/src/services/momentum.service.ts` (lines 17-29, 100-210), `packages/core/src/services/entitlements.service.ts` (lines 107-137), `supabase/functions/intent-refresh/index.ts` (`insertSuggestionsWithFallback` lines 433-468)
- Impact: Higher latency, harder to reason about, and the fallback paths are likely undertested. The schema migration that introduced the new columns (`supabase/migrations/20260402_schema_alignment.sql`) should have landed by now.
- Fix approach: Verify the migration has run in production, then remove all fallback paths and the schema-detection logic. This would eliminate ~100 lines of defensive code.

**[MEDIUM] `momentum.service.ts` is overly complex (317 lines):**
- Issue: `setAvailable()` alone is ~130 lines with 4 code paths (extended insert, fallback insert, extended update, fallback update), each followed by a re-fetch. The function has 6 possible return points.
- Files: `packages/core/src/services/momentum.service.ts` (lines 84-211)
- Impact: Difficult to maintain and reason about correctness.
- Fix approach: After removing legacy schema support, this collapses to a simple upsert.

**[MEDIUM] Presence score computed in two places:**
- Issue: The same scoring algorithm exists in both `packages/core/src/services/presence.service.ts` (`computeScore`, lines 68-142) and `supabase/functions/ai-generate/index.ts` (`handleCronPresence`, lines 372-438). Any change to the scoring model must be synchronized.
- Files: `packages/core/src/services/presence.service.ts` (lines 68-142), `supabase/functions/ai-generate/index.ts` (lines 372-438)
- Impact: Scoring divergence if one is updated but not the other.
- Fix approach: Move the scoring logic into a shared Supabase SQL function, or make `handleCronPresence` the single authoritative implementation and remove the client-side version.

**[MEDIUM] `ai-generate` is a monolithic Edge Function:**
- Issue: A single Edge Function handles 11 different operations (6 user-facing + 5 cron jobs) dispatched by `body.op`. It's 608 lines and growing.
- Files: `supabase/functions/ai-generate/index.ts` (608 lines)
- Impact: Hard to test, hard to set per-function resource limits, and a bug in one handler can crash all 11. Cron operations share the same auth posture as user-facing ones.
- Fix approach: Split into separate Edge Functions per operation or at least per trust boundary (user-facing vs. cron).

**[LOW] Module-level singleton caching in momentum service:**
- Issue: `nearbyFriendsRpcSupported` and `momentumExtendedSchemaSupported` are module-level `let` variables used as caches. In React Native, these persist for the app lifetime and are never reset. If the schema is upgraded while the app is running, the old false value stays cached.
- Files: `packages/core/src/services/momentum.service.ts` (lines 14-15)
- Impact: Users might need to force-quit the app to pick up schema upgrades.
- Fix approach: Add a TTL or let the value reset on error.

## Missing Critical Features

**[HIGH] No RLS policies visible for core tables:**
- Problem: The available migrations only enable RLS on `notifications`, `location_snapshots`, `intent_candidates`, `weekly_insights`, and `momentum_availability`. There are no visible RLS policies for core tables: `plans`, `plan_participants`, `messages`, `threads`, `thread_participants`, `friendships`, `profiles`, `entitlements`, `ai_token_usage`, `suggestions`, `app_events`, `audit_log`, `push_tokens`, `missed_moments`, `ai_jobs`, `user_interests`, `user_preferences`.
- Files: `supabase/migrations/` (all 10 files)
- Impact: If RLS is not enabled on these tables, the Supabase anon key grants read/write access to all rows via the PostgREST API. The service assumes RLS is protecting data, but no migrations confirm it.
- Recommendation: Audit the Supabase dashboard for RLS status. Add migration files that explicitly enable RLS and define policies for every table.

**[HIGH] No rate limiting on Edge Functions:**
- Problem: No rate limiting is implemented on any Edge Function. The AI generation endpoints (`ai-generate`, `intent-refresh`) call paid external APIs (Gemini, Google Places, PredictHQ). An attacker could exhaust API quotas/billing.
- Files: All `supabase/functions/*/index.ts`
- Impact: Potential cost explosion from API abuse.
- Recommendation: Add per-user rate limiting, ideally at the Supabase function level or via a middleware pattern.

**[MEDIUM] No input validation on Edge Function request bodies:**
- Problem: Edge Functions parse `body.op`, `body.userId`, `body.threadId`, etc. without schema validation. No checks for string length, format, or type beyond simple truthiness.
- Files: `supabase/functions/ai-generate/index.ts`, `supabase/functions/matchmaker/index.ts`, `supabase/functions/moderation/index.ts`
- Impact: Malformed input could cause unexpected behavior or inject crafted prompts.
- Recommendation: Add Zod or a similar validation library for request bodies.

**[MEDIUM] No account deletion implementation:**
- Problem: `EventTypes.ACCOUNT_DELETION_REQUESTED` event type is defined but no actual deletion logic exists. No Edge Function or service implements GDPR-compliant data deletion.
- Files: `packages/core/src/services/events.service.ts` (line 29)
- Impact: Cannot comply with GDPR/CCPA right-to-erasure requests.
- Recommendation: Implement a deletion Edge Function that cascades through all user data.

## Fragile Areas

**[HIGH] AI JSON parsing throughout the codebase:**
- Files: `supabase/functions/ai-generate/index.ts` (lines 74-86, 165-170, 225-233, 270-279), `supabase/functions/intent-refresh/index.ts` (lines 540-556), `packages/core/src/ai/gemini-client.ts` (lines 120-129)
- Why fragile: Every AI response is parsed by stripping markdown code fences and calling `JSON.parse()`. If Gemini returns malformed JSON, adds explanatory text, or changes its output format, the parse fails. The catch blocks fall back to hardcoded defaults, silently degrading the user experience.
- Safe modification: Wrap all AI JSON parsing in a shared utility that handles common failure modes (markdown fences, trailing commas, truncated output). Add structured output constraints via Gemini's `response_mime_type: "application/json"` parameter.
- Test coverage: Zero. This is the most fragile untested code path in the app.

**[MEDIUM] OAuth callback flow on web:**
- Files: `apps/mobile/app/(auth)/callback.tsx`, `packages/core/src/providers/AuthProvider.tsx`, `packages/core/src/services/auth.service.ts`
- Why fragile: The callback screen polls `supabase.auth.getSession()` every 200ms for up to 6 seconds. The flow must coordinate with Supabase's internal `_initialize()` lock, and the PKCE code exchange can race with the internal auth handler. Multiple code comments document past breakage.
- Safe modification: Touch auth flows only with manual end-to-end testing across web and native. The current workarounds for the Supabase lock contention are fragile.
- Test coverage: Zero.

**[MEDIUM] Thread summary RPC fallback:**
- Files: `packages/core/src/services/messages.service.ts` (lines 42-120)
- Why fragile: `getThreads()` calls `supabase.rpc('get_thread_summaries')` and falls back to a multi-query client-side implementation if the RPC returns error code 42883 (function not found). The fallback fetches ALL messages for all user threads to compute unread counts, which will degrade as message volume grows.
- Safe modification: Ensure the RPC is deployed, then remove the fallback.
- Test coverage: Zero.

## Performance Bottlenecks

**[HIGH] Fallback thread query fetches all messages:**
- Problem: When the `get_thread_summaries` RPC is unavailable, `getThreadsFallback()` fetches ALL messages across ALL user threads to compute latest-message and unread counts.
- Files: `packages/core/src/services/messages.service.ts` (lines 42-101)
- Cause: The `.in('thread_id', threadIds)` query on `messages` has no limit clause.
- Improvement path: Deploy the `get_thread_summaries` RPC and remove the fallback, or at minimum add per-thread limits.

**[MEDIUM] Cron handlers iterate users sequentially:**
- Problem: All cron handlers in `ai-generate` (`handleCronSuggestions`, `handleCronPresence`, `handleCronReplay`, `handleCronWeeklyInsight`) iterate over active users one at a time in a `for` loop. For `handleCronSuggestions`, each iteration makes an HTTP call to `intent-refresh` which itself makes 3 external API calls.
- Files: `supabase/functions/ai-generate/index.ts` (lines 299-493)
- Cause: Sequential processing within a single Edge Function invocation.
- Improvement path: Use `Promise.allSettled()` with a concurrency limit (e.g., 5 at a time), or split to individual async invocations via pg_net.

**[MEDIUM] `getAvailableUsers` fetches all rows then filters in JS:**
- Problem: Expired availability entries are filtered client-side after fetching all rows for a bucket.
- Files: `packages/core/src/services/momentum.service.ts` (lines 228-245)
- Cause: The query does not include `.gt('available_until', now)`.
- Improvement path: Add `.gt('available_until', new Date().toISOString())` to the Supabase query.

## Dependencies at Risk

**[MEDIUM] Pinned Deno std and Supabase versions in Edge Functions:**
- Risk: All Edge Functions import from `https://deno.land/std@0.208.0/http/server.ts` and `https://esm.sh/@supabase/supabase-js@2.39.0`. These are pinned to specific versions that may have known vulnerabilities. The current `@supabase/supabase-js` in the main package is likely newer (v2.101+).
- Files: All files in `supabase/functions/*/index.ts`
- Impact: Version skew between Edge Functions and client-side Supabase SDK. No automated dependency update process.
- Migration plan: Create an import map (`supabase/functions/deno.json`) with centralized version pins. Update to latest Deno std and Supabase SDK.

## Test Coverage Gaps

**[CRITICAL] No tests exist anywhere in the project:**
- What's not tested: Everything. All 15 services, 15 hooks, 7 Edge Functions, 3 providers, 6 stores, and all UI components.
- Files: All of `packages/core/src/`, `supabase/functions/`, `apps/mobile/`, `apps/web/`
- Risk: Any refactoring or feature addition could introduce regressions with no safety net.
- Priority: Critical. Start with:
  1. AI JSON parsing utilities (most fragile)
  2. `entitlements.service.ts` quota logic (handles money-adjacent decisions)
  3. `billing.service.ts` subscription state machine
  4. `auth.service.ts` extractParams and OAuth flow
  5. Edge Function request validation

---

*Concerns audit: 2026-04-15*
