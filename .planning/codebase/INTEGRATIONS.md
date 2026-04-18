# External Integrations

**Analysis Date:** 2026-04-15

## APIs & External Services

### Google Gemini AI

**Purpose:** AI generation, content moderation, embeddings

**Model:** `gemini-2.0-flash` (generation), `text-embedding-004` (embeddings)

**API Base:** `https://generativelanguage.googleapis.com/v1beta`

**Auth:** API key via `GEMINI_API_KEY` env var

**Used in two contexts:**

1. **Client-side (React Native):** `packages/core/src/ai/gemini-client.ts`
   - `GeminiClient` class implements `LLMClient` interface (`packages/core/src/ai/llm-client.ts`)
   - REST API via `fetch()` (works in both RN and Deno)
   - Operations: `embed()`, `generate()`, `moderate()`, `estimateTokens()`
   - Moderation uses generation with a safety-classifier prompt (not a dedicated moderation API)

2. **Edge Functions (server-side):** Direct `fetch()` calls in 4 functions:
   - `supabase/functions/ai-generate/index.ts` - Suggestions, reply drafts, replays, weekly insights, decision proposals
   - `supabase/functions/intent-refresh/index.ts` - Composes ranked suggestions from candidates
   - `supabase/functions/moderation/index.ts` - Content safety classification
   - Each has its own inline `callGemini()` helper (not shared)

**AI Operations:**
| Operation | Where | What It Does |
|-----------|-------|-------------|
| Intent suggestions | `ai-generate` (op: `intent`) | Generates 1-3 personalized activity suggestions |
| Reply drafts | `ai-generate` (op: `reply_draft`) | Drafts conversational replies for threads |
| Reality replay | `ai-generate` (op: `replay`) | Re-surfaces dismissed/expired suggestions |
| Weekly insight | `ai-generate` (op: `weekly_insight`) | Weekly activity summary + experiment suggestion |
| Decision proposal | `ai-generate` (op: `decision_proposal`) | Proposes plans based on user constraints |
| Suggestion composition | `intent-refresh` | Turns ranked candidates into user-facing suggestions |
| Content moderation | `moderation` | Classifies content for safety risks |

**Quota system:**
- Free tier: 50 daily AI calls
- Pro tier: 500 daily AI calls
- Tracked in `entitlements` table, auto-resets daily
- Implemented in `packages/core/src/services/entitlements.service.ts`

---

### Google Maps / Places API (New)

**Purpose:** Nearby place discovery for Intent Cloud

**API:** Google Places API (New) - `places.googleapis.com/v1/places:searchNearby`

**Auth:** `GOOGLE_MAPS_API_KEY` env var, passed via `X-Goog-Api-Key` header

**Used in:** `supabase/functions/intent-refresh/index.ts` (`fetchGooglePlaces()`)

**Fields requested:** `places.id, places.displayName, places.formattedAddress, places.location, places.primaryType, places.rating, places.userRatingCount`

**Behavior:**
- Maps user interests to Google place types (cafe, restaurant, bar, park, museum, movie_theater, bowling_alley)
- Default fallback types: restaurant, cafe, bar, park
- Max 6 results, ranked by popularity
- Radius: 3000m (DEFAULT_RADIUS_METERS)
- Returns `IntentCandidate` objects with scoring (social_fit, novelty, friction, timing, confidence)

---

### PredictHQ Events API

**Purpose:** Nearby event discovery for Intent Cloud

**API:** `https://api.predicthq.com/v1/events/` and `https://api.predicthq.com/v1/suggested-radius/`

**Auth:** `PREDICTHQ_API_TOKEN` env var, passed via `Authorization: Bearer` header

**Used in:** `supabase/functions/intent-refresh/index.ts` (`fetchPredictHqEvents()`, `fetchPredictHqSuggestedRadius()`)

**Behavior:**
- First fetches suggested radius for the user's location
- Then searches for events within that radius (min 2km)
- Categories: concerts, festivals, performing-arts, community, sports
- Filters: `local_rank >= 20`, future events only
- Max 6 results, sorted by `-local_rank,start`
- Returns `IntentCandidate` objects with event-specific scoring

**Optional:** Gracefully degrades if token not configured (returns empty array)

---

### Expo Push Notification Service

**Purpose:** Push notifications to mobile devices

**API:** `https://exp.host/--/api/v2/push/send`

**Auth:** No auth required (Expo push tokens are self-authenticating)

**Used in:** `supabase/functions/notify/index.ts`

**Behavior:**
- Accepts Expo push tokens from `push_tokens` table
- Sends formatted push notifications with title, body, and data payload
- Auto-cleans dead tokens (DeviceNotRegistered) after each send
- Called from other Edge Functions via internal HTTP (`sendPushDirect()` in `supabase/functions/_shared/notify-helper.ts`)
- Also triggered by `notify_insert_and_push` SQL RPC function

**Client registration:** `packages/core/src/services/notifications.service.ts`
- Uses `expo-notifications` and `expo-device`
- Stores tokens in `push_tokens` table (upsert by user_id + token)
- Sets up Android notification channel with accent color (#BDFF2E)

---

### Stripe (Staged / Dormant)

**Purpose:** Subscription billing for Pro tier

**Status:** NOT ACTIVE. `STRIPE_READY = false` in both:
- `packages/core/src/services/billing.service.ts` (line 29)
- `supabase/functions/billing-webhook/index.ts` (line 12)

**Auth:** `STRIPE_WEBHOOK_SECRET` env var (not yet configured)

**Webhook handler:** `supabase/functions/billing-webhook/index.ts`
- Currently logs and acknowledges webhooks in "staged mode"
- When active, will handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Updates `entitlements` and `profiles` tables

**Client-side:** `packages/core/src/services/billing.service.ts`
- `createCheckout()` - Currently returns staged response with "saved your interest" message
- `cancelSubscription()` - Records cancellation intent but does not execute Stripe API call
- `getSubscription()` - Reads from `entitlements` table

**Infrastructure ready:** Entitlements table has `stripe_customer_id`, `stripe_subscription_id`, `current_period_end` columns

---

### Waitlist Webhook

**Purpose:** Capture waitlist signups from web marketing site

**Used in:** `apps/web/app/api/waitlist/route.ts`

**Auth:** `WAITLIST_WEBHOOK_URL` env var (Next.js server-side)

**Behavior:**
- POST to configurable webhook URL with `{ email, source, referrer, capturedAt }`
- Gracefully falls back to console logging if no webhook URL configured

---

## Data Storage

### Supabase PostgreSQL

**Provider:** Supabase (hosted PostgreSQL)

**Project ID:** `kfqjapikievrgmszrimw`

**Connection (client-side):**
- Mobile: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Web: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Client: `@supabase/supabase-js` ^2.101.1

**Connection (Edge Functions):**
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)
- Client: `@supabase/supabase-js@2.39.0` via esm.sh

**Database Tables (22 tables):**

| Table | Purpose | Key Service |
|-------|---------|-------------|
| `profiles` | User profiles, tier, onboarding | `profile.service.ts` |
| `user_interests` | User interest tags | `ai.service.ts` |
| `user_preferences` | User settings | (direct queries) |
| `plans` | Social plans/activities | `plans.service.ts` |
| `plan_participants` | Plan membership | `plans.service.ts` |
| `threads` | Messaging threads | `messages.service.ts` |
| `thread_participants` | Thread membership | `messages.service.ts` |
| `messages` | Chat messages | `messages.service.ts` |
| `suggestions` | AI-generated suggestions | `suggestions.service.ts` |
| `intent_candidates` | Ranked intent candidates | `intent-refresh` edge fn |
| `missed_moments` | Reality Replay items | `ai-generate` edge fn |
| `weekly_insights` | Weekly AI insights | `ai-generate` edge fn |
| `friendships` | Friend relationships | `friendships.service.ts` |
| `momentum_availability` | User availability signals | `momentum.service.ts` |
| `location_snapshots` | User location captures | `location.service.ts` |
| `presence_daily` | Daily presence scores | `ai-generate` edge fn |
| `entitlements` | Billing/subscription state | `entitlements.service.ts` |
| `ai_token_usage` | Monthly AI token tracking | `ai.service.ts` |
| `ai_jobs` | AI job queue | `ai-generate` edge fn |
| `app_events` | Analytics/activity events | `events.service.ts` |
| `analytics_events` | Legacy analytics | (direct queries) |
| `audit_log` | Security/audit trail | `moderation` edge fn |
| `push_tokens` | Expo push tokens | `notifications.service.ts` |
| `notifications` | In-app notification center | `notifications.service.ts` |
| `reports` | User content reports | `moderation.service.ts` |

**PostgreSQL Extensions:**
- `pg_cron` - Scheduled jobs (6 cron jobs defined in `supabase/migrations/20260402_cron_jobs.sql`)
- `pg_net` - HTTP calls from SQL (used by pg_cron to invoke Edge Functions)

**RPC Functions:**
- `get_nearby_available_friends` - Spatial query for nearby friends with momentum availability
- `notify_insert_and_push` - Atomic notification insert + push dispatch
- `get_thread_summaries` - Thread list with participant info (defined in `supabase/migrations/20260402_get_thread_summaries.sql`)

**Cron Jobs (6 scheduled):**
| Job | Schedule | Target |
|-----|----------|--------|
| `precompute_suggestions` | Every hour | `ai-generate` op: `cron_suggestions` |
| `compute_presence` | Daily 02:00 UTC | `ai-generate` op: `cron_presence` |
| `compute_replay` | Daily 07:00 UTC | `ai-generate` op: `cron_replay` |
| `weekly_insight` | Monday 08:00 UTC | `ai-generate` op: `cron_weekly_insight` |
| `expire_cleanup` | Every 15 min | Pure SQL (expire suggestions + momentum) |
| `retention_purge` | Daily 03:30 UTC | Pure SQL (delete app_events > 90 days) |

### Supabase Storage

**Purpose:** Avatar image uploads

**Bucket:** `avatars`

**Used in:** `packages/core/src/services/profile.service.ts` (`uploadAvatar()`)

**Behavior:**
- Uploads to `{userId}/avatar.{ext}` path
- Uses `upsert: true` to replace existing avatars
- Returns public URL via `getPublicUrl()`

### Caching

- No dedicated caching service (Redis, Memcached, etc.)
- TanStack React Query provides client-side cache:
  - `staleTime: 60s`
  - `gcTime: 5 min`
  - `retry: 1` for queries, `0` for mutations
  - Configured in `packages/core/src/providers/QueryProvider.tsx`

---

## Authentication & Identity

**Provider:** Supabase Auth

**Implementation:** `packages/core/src/services/auth.service.ts`

**Flow:** OAuth PKCE (`flowType: 'pkce'`) configured in `packages/core/src/supabase/client.ts`

**Methods:**
| Method | Implementation |
|--------|---------------|
| Email/password sign-up | `signUpWithEmail()` with `full_name` in user metadata |
| Email/password sign-in | `signInWithEmail()` |
| Google OAuth | `startGoogleOAuth()` + `completeOAuthFromUrl()` |
| Google ID token | `signInWithGoogle()` (direct ID token exchange) |
| Apple Sign-In | `signInWithApple()` (ID token + nonce) |
| Password reset | `resetPassword()` |
| Sign out | `signOut()` |

**Token storage:**
- Mobile (iOS/Android): `expo-secure-store` (Keychain / EncryptedSharedPreferences)
- Web: `localStorage`
- Adapter selected by `Platform.OS` in `packages/core/src/supabase/client.ts`

**OAuth callback handling:**
- Custom `extractParams()` function parses redirect URLs
- Handles both `?code=` (PKCE) and `#access_token=` (implicit) parameters
- `detectSessionInUrl: false` - App code owns the exchange, not the SDK
- Web redirect: `{origin}/callback`
- Mobile redirect: `sovio://callback` (via `makeRedirectUri`)

**Session management:**
- `autoRefreshToken: true`
- `persistSession: true`
- Auth state tracked in Zustand store: `packages/core/src/stores/auth.store.ts`
- `AuthProvider` component: `packages/core/src/providers/AuthProvider.tsx`

---

## Supabase Realtime

**Purpose:** Live updates for notifications and messages

**Implementation:** `packages/core/src/providers/RealtimeProvider.tsx`

**Subscriptions:**
- Global channel `global-realtime` subscribes to:
  - `postgres_changes` on `notifications` table (INSERT, filtered by `user_id`)
  - Invalidates `queryKeys.notifications` and `queryKeys.threads` on new notification
- Per-thread realtime handled separately in thread-detail screen

---

## Supabase Edge Functions (6)

| Function | File | Purpose | Auth |
|----------|------|---------|------|
| `ai-generate` | `supabase/functions/ai-generate/index.ts` | Multi-op AI function (12 operations) | JWT (user ops) / Service role (cron ops) |
| `intent-refresh` | `supabase/functions/intent-refresh/index.ts` | Location-aware suggestion generation | JWT (verified in code, `verify_jwt = false` in config for cron access) |
| `matchmaker` | `supabase/functions/matchmaker/index.ts` | Momentum matching (creates plans + threads) | Service role |
| `moderation` | `supabase/functions/moderation/index.ts` | Content safety classification | Service role |
| `notify` | `supabase/functions/notify/index.ts` | Push notification dispatch | Service role |
| `billing-webhook` | `supabase/functions/billing-webhook/index.ts` | Stripe webhook handler (staged) | None (webhook signature when Stripe active) |

**Shared code:** `supabase/functions/_shared/`
- `supabase.ts` - Shared Supabase client (service role)
- `notify-helper.ts` - `createNotification()` and `sendPushDirect()` helpers

---

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar)
- `console.error` / `console.warn` throughout

**Logs:**
- `console.log` / `console.error` / `console.warn`
- Edge Functions log to Supabase dashboard
- Audit trail: `audit_log` table for security-relevant events (moderation, billing)
- App events: `app_events` table for user activity tracking (90-day retention)

**Analytics:**
- Custom `app_events` table with `event_type`, `payload`, `source` columns
- `analytics_events` table (legacy)
- Tracked via `packages/core/src/services/events.service.ts`

---

## CI/CD & Deployment

**Hosting:**
- Mobile: Expo (EAS Build for production)
- Web: Not explicitly configured (Next.js, likely Vercel)
- Backend: Supabase hosted

**CI Pipeline:**
- Not detected (no `.github/workflows`, no `Makefile`, no CI config files)

**QA:**
- Playwright-based E2E script: `scripts/qa-mobile-web.mjs`
- Runs against mobile web view (`http://127.0.0.1:8081`)
- Takes screenshots to `apps/mobile/qa-screens/`

---

## Environment Configuration

**Required env vars (by context):**

| Variable | Context | Required |
|----------|---------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile app | Yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile app | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Web app | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web app | Yes |
| `SUPABASE_URL` | Edge Functions | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Auto-injected |
| `GEMINI_API_KEY` | Edge Functions | Yes (AI features degrade without) |
| `GOOGLE_MAPS_API_KEY` | Edge Functions | Yes (place suggestions degrade without) |
| `PREDICTHQ_API_TOKEN` | Edge Functions | Optional (event suggestions skip without) |
| `STRIPE_WEBHOOK_SECRET` | Edge Functions | Not yet needed (staged) |
| `WAITLIST_WEBHOOK_URL` | Web app (server) | Optional (falls back to console) |

**Secrets location:**
- Mobile: `.env` files (not committed, referenced via `EXPO_PUBLIC_` prefix)
- Web: `.env.local` (Next.js convention)
- Edge Functions: Supabase Dashboard > Project Settings > Edge Functions > Secrets
- Database: `app.settings.*` PostgreSQL config (for pg_cron service role key)

---

## Webhooks & Callbacks

**Incoming:**
- `POST /functions/v1/billing-webhook` - Stripe webhook endpoint (staged, acknowledges but does not process)
- `POST /functions/v1/ai-generate` - Internal cron entry point (12 operations via `op` field)
- `POST /api/waitlist` - Web app waitlist signup

**Outgoing:**
- Expo Push API (`exp.host`) - Push notifications
- Google Gemini API - AI generation/moderation
- Google Places API - Nearby place search
- PredictHQ API - Nearby event search
- Configurable waitlist webhook URL

---

*Integration audit: 2026-04-15*
