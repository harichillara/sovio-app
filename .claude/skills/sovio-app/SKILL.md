```markdown
# sovio-app Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, workflows, and coding conventions used in the `sovio-app` TypeScript monorepo. The repository leverages Supabase for backend/database, uses Vitest for testing, and is organized for modularity and security. You will learn how to add new features, harden security, manage feature flags, set up CI, wire up observability, and follow the project's conventions for code and commit style.

---

## Coding Conventions

### File Naming

- Use **camelCase** for file names.
  - Example: `userService.ts`, `featureFlagService.ts`

### Import Style

- Use **relative imports** within packages.
  - Example:
    ```typescript
    import userService from './userService'
    import { getFlag } from '../flags/featureFlagService'
    ```

### Export Style

- Use **default exports** for modules.
  - Example:
    ```typescript
    // userService.ts
    const userService = { /* ... */ }
    export default userService
    ```

### Commit Messages

- Follow **Conventional Commits**:
  - Types: `fix`, `feat`, `chore`, `docs`, `refactor`
  - Example: `feat: add RLS policies for feature_flags table`

---

## Workflows

### Database Table Addition and RLS Hardening
**Trigger:** When adding a new feature requiring a new table or hardening access to an existing table  
**Command:** `/new-table`

1. Create SQL migration(s) in `supabase/migrations/` for new table and/or RLS policies.
2. Add/modify RLS policies with canonical naming and a deny-by-default posture.
3. Seed the table with initial data if needed.
4. Update `supabase/config.toml` or related config if new triggers/functions are needed.
5. Update generated types (e.g., `database.types.ts`) if client access is required.
6. Add or update integration tests in `supabase/tests/` or `tests/integration/` to verify RLS boundaries.
7. If client access is needed, add a service and hook in `packages/core/src/services/` and `packages/core/src/hooks/`.

**Example:**
```sql
-- supabase/migrations/20240101_create_feature_flags.sql
create table feature_flags (
  id serial primary key,
  name text unique not null,
  enabled boolean not null default false
);

-- RLS policy
alter table feature_flags enable row level security;
create policy "Authenticated can select" on feature_flags
  for select using (auth.role() = 'authenticated');
```

---

### Edge Function Hardening and Shared Module Extraction
**Trigger:** When improving security, observability, or maintainability of edge functions, or adding shared logic  
**Command:** `/harden-edge-fn`

1. Extract common logic to `supabase/functions/_shared/` (e.g., logger, validate, prompt-safety, rate-limit).
2. Update edge function `index.ts` files to use shared modules.
3. Add or update input validation (often with `zod`) and error handling.
4. Add or update Deno tests for both shared modules and function handlers.
5. Wire up observability (e.g., Sentry scrubber) if not already present.
6. Update `deno.json` or related config to include new tests in CI.

**Example:**
```typescript
// supabase/functions/_shared/validate.ts
import { z } from 'zod'
export const inputSchema = z.object({ id: z.string().uuid() })

// supabase/functions/my-fn/index.ts
import { inputSchema } from '../_shared/validate'
const input = inputSchema.parse(event.body)
```

---

### Feature Flag or Config Table with Client Hook
**Trigger:** When gating features or runtime config behind a flag or table-driven setting  
**Command:** `/add-flag`

1. Create SQL migration for new table (e.g., `feature_flags`) in `supabase/migrations/`.
2. Add RLS policies (authenticated SELECT, service_role for writes).
3. Add a resolver function in SQL if needed (e.g., `is_flag_enabled`).
4. Seed table with initial/default values.
5. Implement service in `packages/core/src/services/` to fetch/resolve flag(s).
6. Implement hook in `packages/core/src/hooks/` for React usage.
7. Add query key and barrel export in `packages/core/src/hooks/queryKeys.ts` and `index.ts`.

**Example:**
```typescript
// packages/core/src/services/featureFlagService.ts
const getFeatureFlag = async (name: string) => {
  // fetch from supabase
}
export default getFeatureFlag

// packages/core/src/hooks/useFeatureFlag.ts
import { useQuery } from 'react-query'
import getFeatureFlag from '../services/featureFlagService'
export default function useFeatureFlag(name: string) {
  return useQuery(['featureFlag', name], () => getFeatureFlag(name))
}
```

---

### Security Hardening and Code Audit Fix Pass
**Trigger:** When a security review, audit, or code review identifies multiple issues  
**Command:** `/audit-fix`

1. Identify and fix security bugs (e.g., IDOR, auth bypass, JWT validation).
2. Align types and unions for stricter type safety.
3. Fix error handling (surface errors, avoid silent failures).
4. Deduplicate code (extract shared components, utilities).
5. Update affected services, hooks, and UI components.
6. Update `.env.example` and `package.json` dependencies if needed.
7. Document audit plan or review log in `docs/`.

**Example:**
```typescript
// Before: silent failure
try {
  await doSensitiveThing()
} catch {}

// After: explicit error handling
try {
  await doSensitiveThing()
} catch (err) {
  logger.error('Sensitive thing failed', err)
  throw err
}
```

---

### CI Pipeline and Test Harness Setup or Update
**Trigger:** When enforcing or expanding automated checks, adding new test harnesses, or updating workspace/test config  
**Command:** `/setup-ci`

1. Add or update CI workflow files (e.g., `.github/workflows/ci.yml`).
2. Add or update workspace config files (e.g., `pnpm-workspace.yaml`, Vitest configs).
3. Add or update scripts for test harnesses (integration, policy snapshot, QA runners).
4. Add or update `.env.example` and related config for new CI/test requirements.
5. Document new workflows or runbooks in `docs/`.

**Example:**
```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm test
```

---

### Sentry Observability Scrubber Wiring
**Trigger:** When ensuring no secrets or PII leak into Sentry error reports  
**Command:** `/wire-sentry-scrubber`

1. Implement or update a Sentry scrubber utility (e.g., `scrubSentryEvent`).
2. Add or update tests for the scrubber.
3. Wire the scrubber into `beforeSend` on all `Sentry.init` sites (web, mobile, edge functions).
4. Add or update Deno-compatible port for edge functions.
5. Verify by running tests and typechecks.

**Example:**
```typescript
// packages/core/src/observability/sentryScrubber.ts
export default function scrubSentryEvent(event) {
  // Remove secrets/PII from event
  return event
}

// apps/web/sentry.config.ts
import scrubSentryEvent from 'core/src/observability/sentryScrubber'
Sentry.init({
  beforeSend: scrubSentryEvent,
  // ...
})
```

---

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test file pattern:** `*.test.ts`
- **Location:** Tests are placed alongside source files or in dedicated test directories such as `supabase/tests/`, `tests/integration/`, or within package directories.

**Example:**
```typescript
// packages/core/src/services/userService.test.ts
import { describe, it, expect } from 'vitest'
import userService from './userService'

describe('userService', () => {
  it('should fetch user by id', async () => {
    const user = await userService.getUser('123')
    expect(user).toBeDefined()
  })
})
```

---

## Commands

| Command                | Purpose                                                        |
|------------------------|----------------------------------------------------------------|
| /new-table             | Add a new database table and/or harden RLS policies            |
| /harden-edge-fn        | Refactor/harden edge functions and extract shared modules      |
| /add-flag              | Add a feature/config flag table with client hook               |
| /audit-fix             | Sweep codebase for security hardening and convention fixes     |
| /setup-ci              | Set up or update CI pipeline and test harnesses                |
| /wire-sentry-scrubber  | Add or update Sentry PII/secret scrubber across all surfaces   |
```
