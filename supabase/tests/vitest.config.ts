import { defineConfig } from 'vitest/config';

// Infra-level unit tests (pg_policies snapshot invariants, etc.).
// Scoped to this directory only — explicit exclude for tests/integration
// since vitest workspace discovery can otherwise walk the whole repo.
export default defineConfig({
  test: {
    name: 'infra',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/tests/integration/**'],
  },
});
