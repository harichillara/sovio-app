# Coding Conventions

**Analysis Date:** 2026-04-15

## Naming Patterns

**Files:**
- UI components: PascalCase, one per file (`Button.tsx`, `SuggestionCard.tsx`, `PresenceScoreRing.tsx`)
- Services: kebab-case with `.service.ts` suffix (`plans.service.ts`, `auth.service.ts`, `entitlements.service.ts`)
- Hooks: camelCase with `use` prefix (`usePlans.ts`, `useMessages.ts`, `useEntitlements.ts`)
- Stores: kebab-case with `.store.ts` suffix (`auth.store.ts`, `plans.store.ts`, `messages.store.ts`)
- Providers: PascalCase with `Provider` suffix (`AuthProvider.tsx`, `QueryProvider.tsx`, `RealtimeProvider.tsx`)
- Type files: lowercase (`types.ts`, `app-types.ts`, `database.types.ts`)
- Screen files: kebab-case matching route segments (`login.tsx`, `create-plan.tsx`, `thread-detail.tsx`)

**Functions:**
- Use camelCase for all functions: `getPlans`, `createPlan`, `handleSignIn`
- Service functions: verb-first (`getProfile`, `updatePlan`, `sendMessage`, `markThreadRead`)
- Hook functions: `use` prefix + PascalCase noun (`usePlans`, `useCreatePlan`, `useSignIn`)
- Event handlers in screens: `handle` prefix (`handleCreate`, `handleGoogleSignIn`, `handleToggle`)
- React components: PascalCase function declarations (`function Button()`, `function TabScreen()`)

**Variables:**
- camelCase for all variables and parameters
- Constants: UPPER_SNAKE_CASE for module-level constants (`FREE_DAILY_LIMIT`, `PRO_DAILY_LIMIT`, `BASE_URL`, `GENERATION_MODEL`)
- Booleans: `is`/`has` prefix for state (`isLoading`, `isPro`, `isAvailable`, `isGenerating`)
- Mutation variables: suffixed with `Mut` or `Mutation` in screens (`acceptMut`, `signInMutation`)

**Types:**
- Interfaces: PascalCase with descriptive suffix (`ButtonProps`, `AuthState`, `ThreadWithMeta`)
- Use `interface` for object shapes, not `type` (except for simple aliases)
- Prop interfaces: component name + `Props` suffix, defined in `packages/ui/src/types.ts`
- Database types: derived from `Database` type using bracket notation in `packages/core/src/supabase/types.ts`
  - Row types: `Profile`, `Plan`, `Message` (no suffix)
  - Insert types: `ProfileInsert`, `PlanInsert` (`Insert` suffix)
  - Update types: `ProfileUpdate`, `PlanUpdate` (`Update` suffix)

## Code Style

**Formatting:**
- No Prettier or formatting tool configured
- Indentation: 2 spaces throughout
- Semicolons: always used
- Quotes: single quotes for strings
- Trailing commas: used in multi-line objects/arrays

**Linting:**
- No ESLint configured at project level
- Type checking via `pnpm typecheck` (runs `tsc --noEmit` per package in dependency order)
- TypeScript `strict: true` in `tsconfig.base.json`

**TypeScript Config:**
- Target: ES2022
- Module: ESNext with bundler resolution
- JSX: react-jsx
- `strict: true`, `skipLibCheck: true`, `isolatedModules: true`, `noEmit: true`
- Config at `tsconfig.base.json`, extended by each package's `tsconfig.json`

## Import Organization

**Order (observed across codebase):**
1. React / React Native core (`import React from 'react'`, `import { View, Text } from 'react-native'`)
2. Third-party libraries (`expo-router`, `@tanstack/react-query`, `framer-motion`)
3. Internal workspace packages (`@sovio/tokens/ThemeContext`, `@sovio/ui`, `@sovio/core`)
4. Relative imports (`'../stores/auth.store'`, `'./styles'`, `'./types'`)

**Path Aliases:**
- Workspace packages via pnpm: `@sovio/core`, `@sovio/ui`, `@sovio/tokens`
- Theme access specifically via: `@sovio/tokens/ThemeContext` (not barrel)
- CSS utilities via: `@sovio/tokens/css`

**Import Style:**
- Named exports preferred throughout
- Services imported as namespace: `import * as plansService from '../services/plans.service'`
- Stores imported as named: `import { useAuthStore } from '../stores/auth.store'`
- Types use `import type` when type-only: `import type { Plan, PlanInsert } from '../supabase/types'`
- `export type *` used for type-only re-exports from barrel files

## Component Patterns

**UI Component Structure (packages/ui/src/):**
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { ComponentNameProps } from './types';

export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.text }]}>{prop1}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { /* static styles */ },
  title: { /* static styles */ },
});
```

**Key rules:**
- Always use `useTheme()` hook -- NEVER pass `theme` as a prop
- Static styles in `StyleSheet.create()` at bottom of file
- Dynamic/theme colors applied via inline style array: `style={[styles.foo, { color: theme.text }]}`
- Shared styles via `createStyles(theme)` from `packages/ui/src/styles.ts`
- Props defined as interfaces in `packages/ui/src/types.ts`, not co-located

**Button pattern -- use `variant` prop, NEVER create separate Primary/Secondary components:**
```typescript
<Button label="Do it" onPress={onAccept} variant="primary" />
<Button label="Not now" onPress={onDismiss} variant="secondary" />
```

**TabScreen template -- use for all tab screens:**
```typescript
export default function SomeTab() {
  const { theme } = useTheme();
  return (
    <TabScreen title="Title" subtitle="Subtitle" headerRight={<TopRightActions />}>
      {/* Screen content */}
    </TabScreen>
  );
}
```

**Non-tab screens use `AppScreen` directly:**
```typescript
export default function SomeModal() {
  return (
    <AppScreen>
      {/* Screen content */}
    </AppScreen>
  );
}
```

**Web components (apps/web/components/):**
- Use `'use client'` directive for interactive components
- CSS class-based styling (BEM-like: `hero-scene__label-kicker`, `pricing-tier--emphasized`)
- CSS variables from `@sovio/tokens/css` via `cssVars(darkTheme)` applied to `<body>` in layout
- Use `framer-motion` for animations
- Props defined as interfaces in the same file (not centralized like mobile UI)

## Color & Theme Rules

**CRITICAL: Never hardcode hex color values in components or screens.**
- All colors come from `@sovio/tokens` theme object
- Access via `const { theme } = useTheme()`
- Theme properties: `background`, `surface`, `surfaceAlt`, `text`, `muted`, `accent`, `accentSoft`, `success`, `danger`, `border`
- Alpha variants via `withAlpha(theme.text, 0.18)` from `@sovio/ui`
- Web CSS variables: `--sovio-background`, `--sovio-accent`, etc. via `cssVars()` from `@sovio/tokens/css`

**Theme tokens defined in:**
- `packages/tokens/src/types.ts` -- `SovioTheme` interface
- `packages/tokens/src/themes.ts` -- `lightTheme` and `darkTheme` objects
- Default mode: `dark`

## Error Handling

**Services -- throw on error (let caller decide):**
```typescript
const { data, error } = await supabase.from('plans').select('*').eq('id', planId).single();
if (error) throw error;
return data;
```

**Hooks -- React Query catches thrown errors automatically:**
```typescript
export function usePlans(filters?) {
  return useQuery({
    queryKey: queryKeys.plans(filters),
    queryFn: async () => {
      const plans = await plansService.getPlans(userId, filters);
      return plans;
    },
    enabled: !!userId,
  });
}
```

**Mutations -- auth guard at hook level:**
```typescript
mutationFn: (planId: string) => {
  if (!userId) throw new Error('Not authenticated');
  return plansService.deletePlan(planId, userId);
},
```

**Screens -- display `mutation.error.message` inline:**
```typescript
{createPlan.error ? (
  <Text style={{ color: theme.danger, fontSize: 14 }}>
    {createPlan.error.message}
  </Text>
) : null}
```

**Non-critical failures -- catch and warn, don't break flow:**
```typescript
try {
  const profile = await profileService.ensureProfile(data.session.user);
  setProfile(profile);
} catch (err) {
  console.warn('[useSignIn] ensureProfile failed after sign-in — profile set to null.',
    err instanceof Error ? err.message : err);
  setProfile(null);
}
```

**Fail-closed for safety-critical paths (moderation):**
```typescript
catch (err) {
  // Fail closed: if moderation is unavailable, treat content as flagged
  console.error('[GeminiClient.moderate] Content moderation failed — defaulting to FLAGGED.', ...);
  return { flagged: true, categories: { moderation_unavailable: true } };
}
```

## Logging

**Framework:** `console` (no structured logging library)

**Patterns:**
- `console.warn` for non-fatal issues that need visibility: RPC fallbacks, analytics failures, OAuth edge cases
- `console.error` for real failures: session restore errors, channel errors, moderation failures
- `console.debug` gated behind `__DEV__` for dev-only diagnostics
- Always prefix with bracket context: `[Realtime]`, `[useSignIn]`, `[Momentum]`, `[billing]`
- Include relevant error message: `err instanceof Error ? err.message : err`
- Analytics tracking failures silently caught -- never break user flows for analytics

## Comments

**When to Comment:**
- JSDoc `/** */` on service functions that have non-obvious behavior (e.g., quota auto-reset, webhook handler safety)
- Inline comments for "why" not "what": `// Fail closed: if moderation is unavailable...`
- Section dividers in longer files: `// ---------------------------------------------------------------------------`
- No TODO/FIXME/HACK comments exist in the codebase (they have been cleaned up)

**JSDoc Usage:**
- Applied to public service functions and interface definitions in `packages/core`
- NOT used on hook functions, UI components, or screen components
- Brief single-line style preferred: `/** Get the entitlement record for a user. Creates one if it doesn't exist. */`

## State Management Patterns

**Zustand stores -- ephemeral/UI state:**
```typescript
import { create } from 'zustand';

interface SomeState {
  items: Item[];
  selectedId: string | null;
  setItems: (items: Item[]) => void;
  setSelectedId: (id: string | null) => void;
  reset: () => void;
}

export const useSomeStore = create<SomeState>((set) => ({
  items: [],
  selectedId: null,
  setItems: (items) => set({ items }),
  setSelectedId: (selectedId) => set({ selectedId }),
  reset: () => set({ items: [], selectedId: null }),
}));
```

**Key Zustand conventions:**
- Every store MUST have a `reset()` method
- All stores are reset on sign-out (see `useSignOut` in `packages/core/src/hooks/useAuth.ts`)
- Store selectors use inline arrow: `useAuthStore((s) => s.user?.id)`
- Stores live in `packages/core/src/stores/`

**React Query -- server state:**
- Centralized query keys in `packages/core/src/hooks/queryKeys.ts` using `as const` tuples
- `staleTime: 60s`, `gcTime: 5min`, `retry: 1` for queries; `retry: 0` for mutations
- Hooks sync React Query data into Zustand stores for cross-component access
- Mutations invalidate related queries via `queryClient.invalidateQueries()`
- `enabled: !!userId` pattern gates queries behind authentication

## Module / Export Patterns

**Barrel exports:**
- `packages/ui/src/index.tsx` -- named re-exports of all UI components
- `packages/core/src/index.ts` -- grouped by category (services, stores, hooks, providers)
- `packages/tokens/src/index.ts` -- theme types and theme objects
- Services exported as namespaces: `export * as plansService from './services/plans.service'`
- Stores and hooks exported as named exports

**One component per file** in `packages/ui/src/`

**Screen files:** default export for Expo Router compatibility (`export default function LoginScreen()`)

## Platform-Specific Patterns

**Cross-platform shadow handling:**
```typescript
...(Platform.OS === 'web'
  ? { boxShadow: `0px 12px 28px ${withAlpha(theme.text, 0.18)}` }
  : {
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    }),
```

**Platform-gated features:**
- Apple Sign-In: `{Platform.OS === 'ios' ? <SocialAuthButton provider="apple" ... /> : null}`
- Storage adapter: SecureStore on native, localStorage on web (see `packages/core/src/supabase/client.ts`)
- SVG vs CSS for graphics: `PresenceScoreRing` uses `react-native-svg` on native, CSS `conic-gradient` on web

---

*Convention analysis: 2026-04-15*
