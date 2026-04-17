/**
 * Env validation. Called from setup.ts. If any required var is missing we
 * throw with a single clear message so the suite fails fast instead of
 * producing confusing "fetch failed" errors deep in the tests.
 */
const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type Env = { [K in (typeof REQUIRED)[number]]: string };

export function requireEnv(): Env {
  const missing: string[] = [];
  const out = {} as Record<string, string>;
  for (const key of REQUIRED) {
    const v = process.env[key];
    if (!v || v.trim() === '') {
      missing.push(key);
    } else {
      out[key] = v;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Integration tests require env vars: ${missing.join(', ')}. ` +
        `Copy tests/integration/.env.example to tests/integration/.env and fill in.`,
    );
  }
  return out as Env;
}

export function env(): Env {
  return requireEnv();
}
