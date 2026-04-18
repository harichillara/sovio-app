#!/usr/bin/env node
/**
 * Regenerate supabase/tests/pg_policies.snapshot.json from the live DB.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<PAT> SUPABASE_PROJECT_REF=<ref> \
 *     node scripts/dump-pg-policies.mjs
 *
 * The PAT is a Supabase Management API personal access token
 * (Dashboard → Account → Tokens). The project ref is the xxxxx portion of
 * your project URL (https://xxxxx.supabase.co).
 *
 * Commit the updated JSON. The vitest snapshot-invariants test
 * (supabase/tests/pg_policies.snapshot.test.ts) will catch any regression.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
if (!PAT || !REF) {
  console.error(
    'Missing env. Required: SUPABASE_ACCESS_TOKEN (PAT), SUPABASE_PROJECT_REF.',
  );
  process.exit(1);
}

const SQL = `
select json_agg(
  jsonb_build_object(
    'tablename', tablename,
    'policyname', policyname,
    'cmd', cmd,
    'permissive', permissive,
    'roles', roles,
    'qual', qual,
    'with_check', with_check
  )
  order by tablename, cmd, policyname
) as policies
from pg_policies
where schemaname = 'public';
`;

const resp = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  },
);

if (!resp.ok) {
  console.error(`HTTP ${resp.status}: ${await resp.text()}`);
  process.exit(2);
}

const rows = await resp.json();
const policies = rows[0]?.policies ?? [];

// Normalize key order for deterministic diffs.
const normalized = policies.map((p) => ({
  tablename: p.tablename,
  policyname: p.policyname,
  cmd: p.cmd,
  permissive: p.permissive,
  roles: p.roles,
  qual: p.qual,
  with_check: p.with_check,
}));

const outPath = join(__dirname, '..', 'supabase', 'tests', 'pg_policies.snapshot.json');
writeFileSync(outPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
console.log(`wrote ${outPath} (${normalized.length} policies)`);
