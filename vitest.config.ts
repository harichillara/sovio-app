import { defineConfig } from 'vitest/config';

// Root vitest config. The workspace (see `vitest.workspace.ts`) scopes the
// "real" tests to the typed TS packages. This root-level config exists purely
// to exclude non-Node test files that vitest would otherwise discover by name:
//
//   - `supabase/functions/**/*.test.ts` — Deno tests. They use URL-pinned
//     imports (`https://deno.land/...`) which Node's ESM loader rejects.
//     Those run via `deno test` in CI; see `.github/workflows/ci.yml`.
//   - `tests/integration/**` — live-Supabase suite. Opt-in via
//     `pnpm test:integration`, which runs it with its own dedicated config
//     (`tests/integration/vitest.integration.config.ts`). Root discovery must
//     not pick it up; it will fail-fast without env vars set.
export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      'supabase/functions/**',
      'tests/integration/**',
    ],
  },
});
