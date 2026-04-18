import { defineConfig } from 'vitest/config';

// This suite MUST NOT be picked up by the root `pnpm test`. It's opt-in via
// `pnpm test:integration` and requires live-Supabase env vars. See README.md.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Integration tests serially mutate prod; no concurrency.
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    // One test can take ~3-5s against live Supabase.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globals: true,
    setupFiles: ['./src/setup.ts'],
  },
});
