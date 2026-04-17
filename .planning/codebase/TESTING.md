# Testing Patterns

**Analysis Date:** 2026-04-15

## Test Framework

**Runner:**
- None configured. No Jest, Vitest, or any test runner is installed or configured at the project level or in any workspace package.

**Assertion Library:**
- None.

**Run Commands:**
```bash
pnpm typecheck              # Only verification: tsc --noEmit per package in dependency order
```

There are no `test`, `test:watch`, or `coverage` scripts in any `package.json`.

## Test File Organization

**Location:**
- No test files exist anywhere in the project source (`packages/` or `apps/`).
- No `__tests__/` directories, no `*.test.ts`, no `*.spec.ts` files.

**Naming:**
- Not established. When adding tests, follow the convention: `{filename}.test.ts` co-located with the source file.

## Current Verification Strategy

The project relies entirely on static type checking as its quality gate.

**Type checking pipeline (defined in root `package.json`):**
```bash
pnpm typecheck
```

This runs `tsc --noEmit` sequentially through packages in dependency order:
1. `@sovio/tokens`
2. `@sovio/core`
3. `@sovio/ui`
4. `@sovio/web`
5. `@sovio/mobile`

**TypeScript strictness** (`tsconfig.base.json`):
- `strict: true` (enables all strict checks)
- `forceConsistentCasingInFileNames: true`
- `isolatedModules: true`
- `skipLibCheck: true`

## What Would Need Testing

### Priority 1: Service Layer (highest value, easiest to test)

All service files in `packages/core/src/services/` are pure async functions that call Supabase and return data or throw. They have no React dependencies, making them straightforward to unit test with a mocked Supabase client.

**Files to test:**
- `packages/core/src/services/plans.service.ts` -- CRUD operations, participant management
- `packages/core/src/services/messages.service.ts` -- Thread queries, RPC fallback logic, participant assertions
- `packages/core/src/services/auth.service.ts` -- OAuth URL extraction (`extractParams`), sign-in flows
- `packages/core/src/services/entitlements.service.ts` -- Quota checking, reset logic, plan creation fallback
- `packages/core/src/services/billing.service.ts` -- Subscription mapping, webhook handling, cancellation
- `packages/core/src/services/profile.service.ts` -- Profile upsert, avatar upload
- `packages/core/src/services/events.service.ts` -- Event tracking
- `packages/core/src/services/suggestions.service.ts` -- Suggestion refresh, accept/dismiss
- `packages/core/src/services/momentum.service.ts` -- Availability toggle, nearby friends, schema fallbacks
- `packages/core/src/services/moderation.service.ts` -- Report/block flows

**Example test structure for service:**
```typescript
// packages/core/src/services/__tests__/plans.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import * as plansService from '../plans.service';

// Mock the supabase client
vi.mock('../../supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    // ...
  },
}));

describe('getPlans', () => {
  it('returns plans for user', async () => {
    // ...
  });

  it('throws on supabase error', async () => {
    // ...
  });
});
```

### Priority 2: AI Client

`packages/core/src/ai/gemini-client.ts` implements the `LLMClient` interface with `fetch` calls. The interface contract in `packages/core/src/ai/llm-client.ts` makes it mockable.

**Key behaviors to test:**
- `generate()` -- handles successful responses and API errors
- `moderate()` -- fails closed (returns `flagged: true` on error)
- `embed()` -- batch embedding with correct request shape
- `estimateTokens()` -- simple `Math.ceil(text.length / 4)`

### Priority 3: Zustand Stores

Stores in `packages/core/src/stores/` are plain Zustand stores with no middleware. Test state transitions directly.

**Files:**
- `packages/core/src/stores/auth.store.ts` -- session/profile lifecycle, reset
- `packages/core/src/stores/plans.store.ts` -- active/suggested plans, selection
- `packages/core/src/stores/messages.store.ts` -- thread list, unread count derivation
- `packages/core/src/stores/ai.store.ts` -- token tracking, generating state

**Example test structure for store:**
```typescript
// packages/core/src/stores/__tests__/auth.store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('sets session and derives user', () => {
    const mockSession = { user: { id: '123' } } as any;
    useAuthStore.getState().setSession(mockSession);
    expect(useAuthStore.getState().user?.id).toBe('123');
  });

  it('resets to initial state', () => {
    useAuthStore.getState().setLoading(false);
    useAuthStore.getState().reset();
    expect(useAuthStore.getState().isLoading).toBe(true);
  });
});
```

### Priority 4: Utility / Pure Functions

Standalone pure functions that are easily unit-testable:

- `packages/core/src/services/auth.service.ts` -- `extractParams()` (URL parsing)
- `packages/core/src/services/entitlements.service.ts` -- `normalizeEntitlement()`, quota logic
- `packages/core/src/services/billing.service.ts` -- `hasActiveProAccess()`, `mapEntitlementRow()`
- `packages/ui/src/styles.ts` -- `withAlpha()` (hex to rgba conversion)
- `packages/tokens/src/css.ts` -- `cssVars()` (theme to CSS variables)
- `packages/core/src/ai/gemini-client.ts` -- `estimateTokens()`

### Priority 5: React Hooks (requires React Testing Library)

Hooks in `packages/core/src/hooks/` wrap React Query and Zustand. Testing requires `@testing-library/react-hooks` or `renderHook` from `@testing-library/react`.

**Key hooks:**
- `packages/core/src/hooks/usePlans.ts` -- query/mutation hooks with store syncing
- `packages/core/src/hooks/useAuth.ts` -- sign-in/sign-out flows with multi-store reset
- `packages/core/src/hooks/useMessages.ts` -- infinite query, realtime subscription
- `packages/core/src/hooks/useEntitlements.ts` -- derived `useIsPro()` boolean

### Priority 6: UI Components (requires React Native Testing Library)

Components in `packages/ui/src/` would need `@testing-library/react-native` and a `ThemeProvider` wrapper.

### Not Recommended for Unit Testing

- Screen files in `apps/mobile/app/` -- complex integration with Expo Router, better suited for E2E
- Web pages in `apps/web/app/` -- better tested with Playwright or Cypress

## Recommended Test Setup

**Framework:** Vitest (aligns with the ESM/bundler module system already configured)

**Installation (when ready):**
```bash
pnpm add -D -w vitest @testing-library/react @testing-library/react-native
```

**Config location:** `vitest.config.ts` at project root or per-package

**Suggested `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // 'jsdom' for component tests
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
  },
});
```

**Add to root `package.json`:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Mocking Strategy

**Supabase client:** The single `supabase` instance exported from `packages/core/src/supabase/client.ts` is the primary mock target. All services import from this module.

**React Query:** Use `QueryClientProvider` with a test `QueryClient` (no retries, no gc).

**Zustand stores:** Call `store.getState().reset()` in `beforeEach` -- all stores have `reset()`.

**LLM client:** The `LLMClient` interface in `packages/core/src/ai/llm-client.ts` is designed for test substitution.

**Platform APIs:** Expo modules (`expo-secure-store`, `expo-location`, `expo-notifications`) need mocking for any test that touches `packages/core`.

## Coverage

**Requirements:** None enforced. No coverage thresholds configured.

**Current effective coverage:** 0% (no tests exist).

**Recommended initial targets when tests are added:**
- Services: 80%+ (critical business logic)
- Stores: 90%+ (simple state machines)
- Pure utilities: 95%+ (trivial to test)
- Hooks: 60%+ (integration-heavy)
- UI components: 40%+ (visual, less value from unit tests)

## E2E Testing

**Framework:** Not configured.

**Recommended:** Maestro for mobile E2E (Expo-compatible), Playwright for web.

**Critical E2E flows:**
1. Sign up -> onboarding -> home screen
2. Create plan -> invite -> respond to invite
3. Messaging: open thread -> send message -> see in list
4. Momentum: toggle available -> see nearby friends
5. Subscription: view pricing -> attempt checkout (staged flow)

---

*Testing analysis: 2026-04-15*
