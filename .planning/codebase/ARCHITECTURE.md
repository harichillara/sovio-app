# Architecture

**Analysis Date:** 2026-04-15

## Pattern Overview

**Overall:** Layered monorepo with shared packages consumed by platform-specific apps.

**Key Characteristics:**
- Strict unidirectional dependency flow: `tokens` -> `ui` -> `core` -> `apps`
- Services layer (pure Supabase data access) decoupled from hooks layer (React Query wrappers)
- Zustand stores hold client-side UI state; React Query holds server state
- Provider hierarchy wraps the app tree: ThemeProvider -> QueryProvider -> AuthProvider -> RealtimeProvider
- Supabase Edge Functions handle server-side AI orchestration and webhook processing

## Dependency Graph

```
@sovio/tokens         (zero internal deps)
    |
    v
@sovio/ui             (depends on @sovio/tokens)
    |
    v
@sovio/core           (depends on @supabase/supabase-js, zustand, @tanstack/react-query)
    |
    +--> @sovio/mobile  (depends on @sovio/core, @sovio/ui, @sovio/tokens, expo-*)
    |
    +--> @sovio/web     (depends on @sovio/tokens, @supabase/ssr, next, framer-motion)
```

**Important:** `@sovio/web` does NOT depend on `@sovio/core`. It uses `@supabase/ssr` directly for its limited auth/account features. Only the mobile app consumes the full core package.

## Layers

**Design Tokens (`packages/tokens/src/`):**
- Purpose: Define the visual language (colors, theme types) consumed everywhere
- Location: `packages/tokens/src/`
- Contains: `SovioTheme` type, `lightTheme`/`darkTheme` objects, `ThemeContext`/`useTheme()` hook, `cssVars()` for web CSS custom properties
- Depends on: React (peer)
- Used by: `@sovio/ui`, `@sovio/mobile`, `@sovio/web`
- Exports:
  - `.` -> `packages/tokens/src/index.ts` (themes + types)
  - `./css` -> `packages/tokens/src/css.ts` (web CSS vars)
  - `./ThemeContext` -> `packages/tokens/src/ThemeContext.tsx` (React provider + useTheme hook)

**UI Components (`packages/ui/src/`):**
- Purpose: Cross-platform React Native components themed via `useTheme()`
- Location: `packages/ui/src/`
- Contains: ~29 components (Button, TabScreen, SuggestionDeck, MessageBubble, etc.), shared styles, prop type definitions
- Depends on: `@sovio/tokens`, `react-native-svg`
- Used by: `@sovio/mobile` (directly imported as `@sovio/ui`)
- Key patterns:
  - All components call `useTheme()` internally -- never accept `theme` as a prop
  - Shared style factory: `createStyles(theme)` in `packages/ui/src/styles.ts`
  - All prop interfaces live in `packages/ui/src/types.ts`
  - Barrel export via `packages/ui/src/index.tsx`

**Core Logic (`packages/core/src/`):**
- Purpose: All business logic, data access, state management, AI client, providers
- Location: `packages/core/src/`
- Contains: services (15), hooks (16), stores (7), providers (3), AI module, Supabase client + types
- Depends on: `@supabase/supabase-js`, `zustand`, `@tanstack/react-query`, `expo-*` (optional peer deps)
- Used by: `@sovio/mobile`
- Sub-layers:
  - `services/` -- pure async functions that call Supabase. No React. No state.
  - `hooks/` -- React Query wrappers over services. Handle caching, invalidation, optimistic updates.
  - `stores/` -- Zustand stores for ephemeral client-side state (selected items, UI flags).
  - `providers/` -- React context providers (Auth, Realtime, Query).
  - `ai/` -- LLM abstraction layer (interface + Gemini implementation).
  - `supabase/` -- Client singleton, generated DB types, app-level type aliases.

**Mobile App (`apps/mobile/`):**
- Purpose: Primary consumer app, Expo + expo-router (file-based routing)
- Location: `apps/mobile/`
- Contains: Screens organized by route groups, one shared component (`TopRightActions`)
- Depends on: `@sovio/core`, `@sovio/ui`, `@sovio/tokens`, Expo SDK ~51
- Screens import from `@sovio/core` for hooks/stores and `@sovio/ui` for components

**Web App (`apps/web/`):**
- Purpose: Marketing site, waitlist, auth pages, account management
- Location: `apps/web/`
- Contains: Next.js 14 App Router pages, marketing components, API routes, own Supabase client
- Depends on: `@sovio/tokens` (for CSS vars), `@supabase/ssr`, `next`, `framer-motion`
- Does NOT use `@sovio/core` -- has its own lighter Supabase client at `apps/web/lib/supabase.ts`

**Supabase Edge Functions (`supabase/functions/`):**
- Purpose: Server-side processing (AI generation, billing webhooks, matchmaking, notifications, moderation)
- Location: `supabase/functions/`
- Contains: 6 functions: `ai-generate`, `billing-webhook`, `intent-refresh`, `matchmaker`, `moderation`, `notify`
- Runtime: Deno
- Uses service-role key for privileged DB access
- Shared utilities in `supabase/functions/_shared/`

## Data Flow

**Suggestion Refresh (Intent Cloud):**

1. User taps "Refresh" on Home tab -> `useRefreshSuggestions()` mutation fires
2. `suggestionsService.refreshSuggestions()` calls `intent-refresh` Edge Function via HTTP with user's auth token + coords
3. Edge Function authenticates JWT, fetches user profile + interests from DB
4. Parallel fetches: Google Places API, PredictHQ Events API, nearby friends RPC
5. Candidates ranked by composite score (social_fit * 0.34 + timing * 0.24 + confidence * 0.18 + novelty * 0.14 + (1-friction) * 0.10)
6. Gemini composes natural-language suggestions from top candidates
7. Suggestions inserted into `suggestions` table, returned to client
8. React Query cache updated, `useSuggestionsStore` synced, UI re-renders

**Auth Flow (PKCE OAuth):**

1. User taps "Sign in with Google" -> `authService.startGoogleOAuth(redirectUrl)` opens browser
2. Supabase Auth redirects to Google, user consents, redirect back with `?code=...`
3. Native: deep link `sovio://callback?code=...` handled by `AuthProvider`'s Linking listener
4. Web: dedicated `/callback` route handles exchange
5. `authService.completeOAuthFromUrl()` calls `supabase.auth.exchangeCodeForSession(code)`
6. `AuthProvider.onAuthStateChange` fires -> `profileService.ensureProfile()` upserts profile row
7. Auth store updated: `session`, `user`, `profile`, `isOnboarded`
8. `RouteGuard` in `_layout.tsx` reads auth store and redirects to appropriate route

**Message Send:**

1. User sends message -> `useSendMessage()` mutation
2. `messagesService.sendMessage()` asserts thread participation, inserts into `messages` table
3. Supabase Realtime broadcasts INSERT to `messages:${threadId}` channel
4. `useRealtimeMessages()` hook (active in thread-detail) receives broadcast
5. Invalidates `queryKeys.messages(threadId)` and `queryKeys.threads(userId)`
6. React Query refetches, UI updates with new message

**State Management:**

- **Server state** (plans, messages, profiles, suggestions, presence scores): Managed by React Query via hooks in `packages/core/src/hooks/`. Default staleTime: 60s, gcTime: 5min, retry: 1.
- **Client UI state** (selected plan, active thread, generating flag): Managed by Zustand stores in `packages/core/src/stores/`. Synchronous, no persistence.
- **Auth state** (session, user, profile, isOnboarded, isLoading): Zustand store (`useAuthStore`) hydrated by `AuthProvider` on mount.
- **Dual-write pattern**: Some hooks (e.g., `usePlans`, `useThreads`, `useSuggestions`) write to both React Query cache AND Zustand stores in `queryFn`, keeping both in sync.
- **Sign-out cleanup**: `useSignOut()` clears ALL stores (auth, messages, AI, location, suggestions, presence, plans) and the React Query cache.

## Key Abstractions

**LLMClient Interface:**
- Purpose: Provider-agnostic AI contract (embed, generate, moderate, estimateTokens)
- Definition: `packages/core/src/ai/llm-client.ts`
- Implementation: `packages/core/src/ai/gemini-client.ts` (Gemini 2.0 Flash REST API)
- Used by: `packages/core/src/services/moderation.service.ts`, Edge Functions
- Design: Can be swapped for tests or alternative providers

**Context Builders:**
- Purpose: Structured prompt construction for different AI tasks
- Location: `packages/core/src/ai/context-builder.ts`
- Functions: `buildIntentContext`, `buildReplyContext`, `buildReplayContext`, `buildDecisionContext`, `buildInsightContext`
- Pattern: Safety header + context pack + task description + JSON output schema

**Service Layer:**
- Purpose: All Supabase data access as pure async functions
- Location: `packages/core/src/services/*.service.ts`
- Pattern: Import `supabase` singleton, import types, export named async functions
- Authorization: Services use `userId` parameter in WHERE clauses as defense-in-depth alongside RLS
- Naming: `{domain}.service.ts` (e.g., `plans.service.ts`, `messages.service.ts`)

**Query Keys:**
- Purpose: Centralized React Query cache key definitions
- Location: `packages/core/src/hooks/queryKeys.ts`
- Pattern: Object with methods returning `const` tuples: `queryKeys.plans(filters)` -> `['plans', filters] as const`
- Used by: All hooks and `RealtimeProvider` for targeted invalidation

**Entitlements System:**
- Purpose: Quota management and subscription tier enforcement
- Location: `packages/core/src/services/entitlements.service.ts` + `packages/core/src/services/billing.service.ts`
- Pattern: `entitlements` table is source of truth. Daily AI call quota with auto-reset. Optimistic concurrency via CAS (compare-and-swap) on `daily_ai_calls_used`.
- Tiers: Free (50 daily AI calls), Pro (500 daily AI calls)
- Billing: Currently "staged" mode (STRIPE_READY = false) -- captures intent but does not process payments

## Entry Points

**Mobile App Root:**
- Location: `apps/mobile/app/_layout.tsx`
- Provider hierarchy: `ThemeProvider` > `QueryProvider` > `AuthProvider` > `RealtimeProvider` > `RouteGuard`
- `RouteGuard` component handles route protection based on auth + onboarding state

**Mobile Entry Screen:**
- Location: `apps/mobile/app/index.tsx`
- Redirects based on: !session -> login, !onboarded -> onboarding, else -> home

**Web App Root:**
- Location: `apps/web/app/layout.tsx`
- Server component. Applies `cssVars(darkTheme)` as inline styles. No providers (web is mostly static/marketing).

**Supabase Edge Functions:**
- Location: `supabase/functions/{name}/index.ts`
- Pattern: Deno `serve()` handler with CORS, JWT auth via service-role client

## Error Handling

**Strategy:** Throw-and-catch with Supabase error propagation.

**Patterns:**
- Services throw on Supabase errors: `if (error) throw error;`
- Hooks propagate errors to React Query's error state (accessible via `isError`, `error` on query/mutation result)
- Non-critical failures (analytics tracking, profile fetch on auth change) use `try/catch` with `console.warn` -- never break the main flow
- AI moderation fails closed: if moderation API is unavailable, content is flagged as unsafe by default (`packages/core/src/ai/gemini-client.ts`)
- Edge Functions return HTTP error codes with JSON error body
- Optimistic concurrency (CAS pattern) with retry loops in `entitlements.service.ts` and `ai.service.ts`

## Cross-Cutting Concerns

**Logging:**
- Console-based: `console.error`, `console.warn`, `console.info`
- Pattern: `[ComponentName]` prefix for provider/service logs, e.g., `[AuthProvider]`, `[Realtime]`
- DEV-only logging via `__DEV__` guard in auth flows

**Validation:**
- Input validation at service layer (e.g., `assertThreadParticipant` in messages)
- Content safety via `moderation.service.ts` (Gemini-based with keyword fallback)
- Edge Functions validate JWT and user ownership

**Authentication:**
- Supabase Auth with PKCE flow
- `AuthProvider` manages session lifecycle: restore, OAuth callback, state change listener
- Platform-specific storage: `expo-secure-store` (native) vs `localStorage` (web)
- `detectSessionInUrl: false` -- app code owns the PKCE exchange, not the Supabase client

**Realtime:**
- `RealtimeProvider` subscribes to `notifications` table changes scoped to current user
- Per-thread realtime handled locally by `useRealtimeMessages()` hook in thread-detail screen
- Pattern: Realtime events trigger React Query invalidation, not direct state mutation

**Event Tracking:**
- Centralized event types in `packages/core/src/services/events.service.ts`
- `trackEvent(userId, eventType, payload, source)` inserts into `app_events` table
- Used for analytics, presence score computation, and billing interest tracking

---

*Architecture analysis: 2026-04-15*
