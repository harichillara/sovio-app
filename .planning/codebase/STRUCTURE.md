# Codebase Structure

**Analysis Date:** 2026-04-15

## Directory Layout

```
sovio/
├── apps/
│   ├── mobile/                   # Expo 51 + expo-router (primary app)
│   │   ├── app/                  # File-based routing (expo-router)
│   │   │   ├── _layout.tsx       # Root layout: providers + RouteGuard
│   │   │   ├── index.tsx         # Entry redirect screen
│   │   │   ├── onboarding.tsx    # Onboarding flow
│   │   │   ├── (auth)/           # Auth route group
│   │   │   │   ├── _layout.tsx   # Auth layout with redirect guard
│   │   │   │   ├── login.tsx
│   │   │   │   ├── signup.tsx
│   │   │   │   ├── callback.tsx  # OAuth PKCE callback handler
│   │   │   │   └── forgot-password.tsx
│   │   │   ├── (tabs)/           # Main tab navigator
│   │   │   │   ├── _layout.tsx   # Tab bar config (4 tabs)
│   │   │   │   ├── home.tsx      # Intent Cloud / suggestions
│   │   │   │   ├── momentum.tsx  # Availability + nearby friends
│   │   │   │   ├── messages.tsx  # Thread list
│   │   │   │   └── replay.tsx    # Missed moments
│   │   │   ├── (modals)/         # Modal route group (presentation: modal)
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── create-plan.tsx
│   │   │   │   ├── plan-detail.tsx
│   │   │   │   ├── thread-detail.tsx
│   │   │   │   ├── edit-profile.tsx
│   │   │   │   ├── subscription.tsx
│   │   │   │   ├── presence-score.tsx
│   │   │   │   ├── weekly-insight.tsx
│   │   │   │   ├── decision-autopilot.tsx
│   │   │   │   ├── ai-settings.tsx
│   │   │   │   └── report.tsx
│   │   │   └── settings/         # Settings stack (not a route group)
│   │   │       ├── _layout.tsx
│   │   │       ├── index.tsx     # Settings hub
│   │   │       ├── privacy.tsx
│   │   │       ├── notifications.tsx
│   │   │       └── support.tsx
│   │   ├── components/           # Mobile-only shared components
│   │   │   └── TopRightActions.tsx
│   │   ├── qa-screens/           # QA/testing screens (not shipped)
│   │   ├── index.js              # Expo entry point
│   │   ├── metro.config.js       # Metro bundler config
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                      # Next.js 14 App Router (marketing + auth)
│       ├── app/
│       │   ├── layout.tsx        # Root layout: fonts, CSS vars, header/footer
│       │   ├── page.tsx          # Landing page (marketing)
│       │   ├── globals.css       # Global styles
│       │   ├── WebNav.tsx        # Navigation component
│       │   ├── (auth)/           # Auth route group
│       │   │   ├── layout.tsx    # Centered auth layout
│       │   │   ├── login/page.tsx
│       │   │   └── signup/page.tsx
│       │   ├── pricing/page.tsx
│       │   ├── waitlist/page.tsx
│       │   ├── account/          # Authenticated account pages
│       │   │   ├── page.tsx      # Account overview ('use client')
│       │   │   └── privacy/page.tsx
│       │   └── api/              # API routes
│       │       ├── health/route.ts
│       │       └── waitlist/route.ts
│       ├── components/
│       │   └── marketing/        # Marketing page components
│       │       ├── HeroScene.tsx
│       │       ├── SignalBackground.tsx
│       │       ├── FeatureStory.tsx
│       │       ├── LoopRail.tsx
│       │       ├── SectionShell.tsx
│       │       ├── PricingTier.tsx
│       │       ├── WaitlistForm.tsx
│       │       └── AmbientGrid.tsx
│       ├── content/              # Marketing copy data
│       │   ├── marketing.ts
│       │   └── types.ts
│       ├── lib/
│       │   └── supabase.ts       # Web-specific Supabase browser client
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── tokens/                   # Design tokens (zero deps)
│   │   └── src/
│   │       ├── index.ts          # Barrel: themes + types
│   │       ├── types.ts          # SovioTheme interface
│   │       ├── themes.ts         # lightTheme, darkTheme objects
│   │       ├── ThemeContext.tsx   # ThemeProvider + useTheme()
│   │       └── css.ts            # cssVars() for web CSS custom properties
│   │
│   ├── ui/                       # Cross-platform React Native components
│   │   └── src/
│   │       ├── index.tsx         # Barrel: all component exports
│   │       ├── types.ts          # All prop interfaces
│   │       ├── styles.ts         # createStyles(theme), withAlpha()
│   │       ├── AppScreen.tsx
│   │       ├── AppHeader.tsx
│   │       ├── TabScreen.tsx     # Template for tab screens
│   │       ├── Button.tsx        # variant='primary'|'secondary'
│   │       ├── TextInput.tsx
│   │       ├── Avatar.tsx
│   │       ├── LoadingOverlay.tsx
│   │       ├── EmptyState.tsx
│   │       ├── MessageBubble.tsx
│   │       ├── SuggestionCard.tsx
│   │       ├── SuggestionDeck.tsx
│   │       ├── PresenceScoreRing.tsx
│   │       ├── AvailableToggle.tsx
│   │       ├── ReportSheet.tsx
│   │       ├── BlockConfirmModal.tsx
│   │       ├── QueueToast.tsx
│   │       ├── InsightCard.tsx
│   │       ├── QuotaMeter.tsx
│   │       ├── TokenMeter.tsx
│   │       ├── UpgradeBanner.tsx
│   │       ├── HeroActionCard.tsx
│   │       ├── MiniActionCard.tsx
│   │       ├── PillChip.tsx
│   │       ├── StepProgress.tsx
│   │       ├── ThemeToggle.tsx
│   │       ├── SocialAuthButton.tsx
│   │       └── ToggleRow.tsx
│   │
│   └── core/                     # Business logic, data access, state
│       └── src/
│           ├── index.ts          # Barrel: services, stores, hooks, providers, AI
│           ├── brand.ts          # App name, tagline, marketing copy
│           ├── onboarding.ts     # Interest + preference options
│           ├── supabase/
│           │   ├── client.ts     # Supabase singleton (platform-adaptive storage)
│           │   ├── types.ts      # Row/Insert/Update type aliases
│           │   ├── app-types.ts  # Narrow app-level types (enums)
│           │   └── database.types.ts  # Auto-generated Supabase DB types
│           ├── ai/
│           │   ├── llm-client.ts      # LLMClient interface
│           │   ├── gemini-client.ts   # Gemini 2.0 Flash implementation
│           │   └── context-builder.ts # RAG prompt builders (5 functions)
│           ├── services/              # Pure data access functions
│           │   ├── auth.service.ts
│           │   ├── profile.service.ts
│           │   ├── plans.service.ts
│           │   ├── messages.service.ts
│           │   ├── suggestions.service.ts
│           │   ├── presence.service.ts
│           │   ├── momentum.service.ts
│           │   ├── friendships.service.ts
│           │   ├── notifications.service.ts
│           │   ├── location.service.ts
│           │   ├── ai.service.ts
│           │   ├── autopilot.service.ts
│           │   ├── events.service.ts
│           │   ├── entitlements.service.ts
│           │   ├── billing.service.ts
│           │   └── moderation.service.ts
│           ├── hooks/                 # React Query wrappers
│           │   ├── queryKeys.ts       # Centralized cache key definitions
│           │   ├── useAuth.ts
│           │   ├── useProfile.ts
│           │   ├── usePlans.ts
│           │   ├── useMessages.ts
│           │   ├── useSuggestions.ts
│           │   ├── usePresence.ts
│           │   ├── useMomentum.ts
│           │   ├── useFriends.ts
│           │   ├── useAITokens.ts
│           │   ├── useMissedMoments.ts
│           │   ├── useEntitlements.ts
│           │   ├── useEvents.ts
│           │   ├── useAutopilot.ts
│           │   ├── useBilling.ts
│           │   └── useNotificationCenter.ts
│           ├── stores/                # Zustand client-side state
│           │   ├── auth.store.ts
│           │   ├── plans.store.ts
│           │   ├── messages.store.ts
│           │   ├── ai.store.ts
│           │   ├── location.store.ts
│           │   ├── suggestions.store.ts
│           │   └── presence.store.ts
│           └── providers/             # React context providers
│               ├── AuthProvider.tsx
│               ├── RealtimeProvider.tsx
│               └── QueryProvider.tsx
│
├── supabase/                     # Supabase project config
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── _shared/              # Shared utilities
│   │   │   ├── supabase.ts
│   │   │   └── notify-helper.ts
│   │   ├── ai-generate/index.ts
│   │   ├── billing-webhook/index.ts
│   │   ├── intent-refresh/index.ts
│   │   ├── matchmaker/index.ts
│   │   ├── moderation/index.ts
│   │   └── notify/index.ts
│   └── migrations/               # SQL migrations (10 files)
│
├── scripts/                      # Build/QA scripts
│   └── qa-mobile-web.mjs
│
├── docs/                         # Documentation
│   ├── brand/
│   ├── design/
│   ├── expodevbuild/
│   └── superpowers/
│       ├── plans/
│       └── specs/
│
├── package.json                  # Root workspace config
├── pnpm-workspace.yaml           # Workspace definition
├── pnpm-lock.yaml
├── tsconfig.base.json            # Shared TS config
├── CLAUDE.md                     # Project rules for AI
└── AGENTS.md
```

## Directory Purposes

**`packages/tokens/src/`:**
- Purpose: Single source of truth for all design tokens
- Contains: Theme type (`SovioTheme`), two theme objects (`lightTheme`, `darkTheme`), React theme context, CSS variable generator
- Key files: `themes.ts` (color values), `ThemeContext.tsx` (provider + hook), `css.ts` (web integration)

**`packages/ui/src/`:**
- Purpose: Reusable cross-platform UI components (React Native)
- Contains: 29 components, each one file per component
- Key files: `types.ts` (all prop interfaces), `styles.ts` (shared style factory), `index.tsx` (barrel)

**`packages/core/src/services/`:**
- Purpose: Pure async data access functions -- no React, no state
- Contains: 16 service modules, each focused on one domain
- Pattern: Import `supabase` singleton, export named async functions
- Key files: `plans.service.ts`, `messages.service.ts`, `suggestions.service.ts`

**`packages/core/src/hooks/`:**
- Purpose: React Query wrappers that connect services to React components
- Contains: 16 hook modules + `queryKeys.ts`
- Pattern: Each hook wraps a service function with `useQuery`/`useMutation`/`useInfiniteQuery`

**`packages/core/src/stores/`:**
- Purpose: Zustand stores for ephemeral client-side UI state
- Contains: 7 stores (auth, plans, messages, ai, location, suggestions, presence)
- Pattern: Each store has a `reset()` method called on sign-out

**`packages/core/src/providers/`:**
- Purpose: React context providers that wrap the app tree
- Contains: AuthProvider (session lifecycle), RealtimeProvider (Supabase realtime), QueryProvider (React Query client)

**`packages/core/src/ai/`:**
- Purpose: AI/LLM abstraction layer
- Contains: Interface definition, Gemini implementation, prompt/context builders

**`packages/core/src/supabase/`:**
- Purpose: Supabase client setup and type definitions
- Contains: Client singleton with platform-adaptive storage, generated DB types, derived type aliases

**`apps/mobile/app/`:**
- Purpose: expo-router file-based routes for the mobile app
- Contains: Route groups `(auth)`, `(tabs)`, `(modals)`, plus `settings/` stack and standalone screens
- Key files: `_layout.tsx` (provider tree + route guard), `(tabs)/_layout.tsx` (tab config)

**`apps/web/app/`:**
- Purpose: Next.js 14 App Router pages
- Contains: Marketing pages, auth pages, account management, API routes
- Key files: `layout.tsx` (global layout), `page.tsx` (landing page)

**`apps/web/components/marketing/`:**
- Purpose: Components specific to the marketing landing page
- Contains: 8 components (HeroScene, FeatureStory, etc.)

**`apps/web/content/`:**
- Purpose: Marketing copy and data
- Contains: `marketing.ts` (feature descriptions, CTAs), `types.ts` (content type definitions)

**`supabase/functions/`:**
- Purpose: Server-side Deno edge functions
- Contains: 6 functions for AI, billing, matchmaking, notifications, moderation
- Key: `intent-refresh/index.ts` is the largest and most complex (~719 lines)

**`supabase/migrations/`:**
- Purpose: SQL schema migrations
- Contains: 10 migration files dated 2026-04-02 through 2026-04-03

## Key File Locations

**Entry Points:**
- `apps/mobile/app/_layout.tsx`: Mobile app root (provider hierarchy + route guard)
- `apps/mobile/app/index.tsx`: Mobile entry redirect screen
- `apps/web/app/layout.tsx`: Web root layout (server component)
- `apps/web/app/page.tsx`: Web landing page
- `supabase/functions/intent-refresh/index.ts`: Intent Cloud edge function

**Configuration:**
- `package.json`: Root workspace scripts
- `pnpm-workspace.yaml`: Workspace member definitions
- `tsconfig.base.json`: Shared TypeScript config
- `apps/mobile/tsconfig.json`: Mobile TS config with `@sovio/*` path aliases
- `apps/web/tsconfig.json`: Web TS config (no path aliases, uses workspace resolution)

**Core Logic:**
- `packages/core/src/index.ts`: Full barrel export of all core modules
- `packages/core/src/supabase/client.ts`: Supabase client singleton
- `packages/core/src/supabase/database.types.ts`: Auto-generated DB schema types
- `packages/core/src/hooks/queryKeys.ts`: React Query cache key definitions

**Testing:**
- No test files detected in the codebase

## Naming Conventions

**Files:**
- Components: PascalCase `.tsx` (e.g., `SuggestionCard.tsx`, `TabScreen.tsx`)
- Services: kebab-case `.service.ts` (e.g., `plans.service.ts`, `auth.service.ts`)
- Hooks: camelCase `use*.ts` (e.g., `usePlans.ts`, `useAuth.ts`)
- Stores: kebab-case `.store.ts` (e.g., `auth.store.ts`, `plans.store.ts`)
- Types: kebab-case `.types.ts` or `types.ts` (e.g., `database.types.ts`)
- Layouts: `_layout.tsx` (expo-router convention)
- Pages (web): `page.tsx` (Next.js App Router convention)
- Route handlers: `route.ts` (Next.js App Router convention)

**Directories:**
- Route groups: `(groupName)/` with parentheses (e.g., `(auth)`, `(tabs)`, `(modals)`)
- Feature domains: lowercase singular (e.g., `services`, `hooks`, `stores`, `providers`)

**Exports:**
- Services exported as namespaces: `export * as plansService from './services/plans.service'`
- Stores exported as named hooks: `export { usePlansStore } from './stores/plans.store'`
- Hooks exported with star: `export * from './hooks/usePlans'`
- Components exported as named: `export { Button } from './Button'`

## Import Aliases

**Mobile (`apps/mobile/tsconfig.json`):**
```json
{
  "@sovio/tokens": ["../../packages/tokens/src/index.ts"],
  "@sovio/tokens/*": ["../../packages/tokens/src/*"],
  "@sovio/core": ["../../packages/core/src/index.ts"],
  "@sovio/ui": ["../../packages/ui/src/index.tsx"]
}
```

**Web:** No path aliases configured. Uses pnpm workspace resolution for `@sovio/tokens`.

## Where to Add New Code

**New UI Component:**
1. Create `packages/ui/src/MyComponent.tsx` (PascalCase)
2. Add prop interface to `packages/ui/src/types.ts`
3. Add `export { MyComponent } from './MyComponent'` to `packages/ui/src/index.tsx`
4. Use `useTheme()` internally -- never accept theme as prop
5. Use `createStyles(theme)` from `packages/ui/src/styles.ts` for shared styles

**New Service (data access):**
1. Create `packages/core/src/services/myDomain.service.ts`
2. Import `supabase` from `../supabase/client`
3. Import types from `../supabase/types`
4. Export named async functions
5. Add `export * as myDomainService from './services/myDomain.service'` to `packages/core/src/index.ts`

**New Hook (React Query wrapper):**
1. Create `packages/core/src/hooks/useMyDomain.ts`
2. Import from `@tanstack/react-query` and the corresponding service
3. Add cache keys to `packages/core/src/hooks/queryKeys.ts`
4. Add `export * from './hooks/useMyDomain'` to `packages/core/src/index.ts`

**New Zustand Store:**
1. Create `packages/core/src/stores/myDomain.store.ts`
2. Include a `reset()` method (called on sign-out)
3. Export from `packages/core/src/index.ts`
4. Add `useMyDomainStore.getState().reset()` to `useSignOut()` in `packages/core/src/hooks/useAuth.ts`

**New Mobile Screen:**
- Tab screen: `apps/mobile/app/(tabs)/myTab.tsx` + register in `(tabs)/_layout.tsx`
- Modal screen: `apps/mobile/app/(modals)/my-modal.tsx` (auto-discovered by expo-router)
- Settings screen: `apps/mobile/app/settings/my-setting.tsx` + register in `settings/_layout.tsx`
- Auth screen: `apps/mobile/app/(auth)/my-auth.tsx`
- Screen pattern: Import from `@sovio/core` (hooks/stores) and `@sovio/ui` (components), use `TabScreen` template for tabs

**New Web Page:**
- Marketing: `apps/web/app/my-page/page.tsx` (server component)
- Auth: `apps/web/app/(auth)/my-auth/page.tsx`
- API route: `apps/web/app/api/my-endpoint/route.ts`

**New Edge Function:**
1. Create `supabase/functions/my-function/index.ts`
2. Use Deno `serve()` pattern with CORS headers
3. Authenticate JWT via `supabase.auth.getUser(token)`
4. Use service-role client for DB access

**New Supabase Migration:**
1. Create `supabase/migrations/YYYYMMDD_description.sql`
2. Update `packages/core/src/supabase/database.types.ts` if schema changes (via `supabase gen types typescript`)
3. Add type aliases to `packages/core/src/supabase/types.ts` if new tables added

## Special Directories

**`supabase/migrations/`:**
- Purpose: SQL schema migrations for Supabase
- Generated: No (hand-written)
- Committed: Yes

**`packages/core/src/supabase/database.types.ts`:**
- Purpose: Auto-generated TypeScript types from Supabase schema
- Generated: Yes (via `supabase gen types typescript`)
- Committed: Yes (checked in as snapshot)

**`apps/mobile/qa-screens/`:**
- Purpose: QA/testing screens for manual testing
- Generated: No
- Committed: Yes (but not part of production routing)

**`.planning/`:**
- Purpose: AI planning and analysis documents
- Generated: Yes (by Claude Code)
- Committed: Varies

**`.remember/`:**
- Purpose: Claude Code memory/session logs
- Generated: Yes
- Committed: Varies

**`docs/`:**
- Purpose: Product documentation, brand guidelines, design specs, superpower specs
- Subdirs: `brand/`, `design/`, `expodevbuild/`, `superpowers/plans/`, `superpowers/specs/`
- Generated: No (hand-written)
- Committed: Yes

---

*Structure analysis: 2026-04-15*
