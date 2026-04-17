import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core',
  'packages/tokens',
  'packages/ui',
  // Infra-level unit tests: pg_policies snapshot invariants, shared SQL
  // fixture shape checks, etc. Points at a dedicated config file in
  // supabase/tests so the include-glob is scoped properly and doesn't
  // bleed into tests/integration (which is opt-in live-Supabase).
  'supabase/tests',
]);
