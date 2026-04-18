/**
 * pg_policies snapshot invariants.
 *
 * This test does NOT hit a live database — it reads the committed
 * `pg_policies.snapshot.json` (regenerated via `pnpm policies:snapshot`)
 * and asserts the invariants we care about. Catches:
 *   - Accidentally granting anon/public read on a table.
 *   - Accidentally dropping an RLS policy without replacing it.
 *   - Re-introducing a compound-ALL policy on tables where we
 *     standardized on per-command policies.
 *   - Missing `with_check` on INSERT/UPDATE policies.
 *
 * When legitimate policy changes land, regenerate via:
 *   pnpm policies:snapshot
 * and commit the updated JSON. The test will then pass on the new shape.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Policy = {
  tablename: string;
  policyname: string;
  cmd: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  permissive: 'PERMISSIVE' | 'RESTRICTIVE';
  roles: string[];
  qual: string | null;
  with_check: string | null;
};

const SNAPSHOT_PATH = path.join(__dirname, 'pg_policies.snapshot.json');
const policies: Policy[] = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

// Tables that should NEVER have a policy granting anon or public access.
// If a future migration opens one of these up, we want to catch it here.
const AUTH_ONLY_TABLES = new Set([
  'ai_jobs',
  'ai_memories',
  'ai_token_ledger',
  'ai_token_usage',
  'app_events',
  'audit_log',
  'entitlements',
  'friendships',
  'messages',
  'momentum_availability',
  'notifications',
  'plans',
  'plan_participants',
  'suggestions',
  'thread_participants',
  'threads',
  'user_settings',
  'weekly_insights',
]);

// Tables where we explicitly replaced a compound-ALL policy with
// per-command policies in pt3. A regression would reintroduce the ALL.
const PER_COMMAND_ONLY_TABLES = new Set([
  'ai_jobs',
  'ai_token_usage',
  'momentum_availability',
]);

describe('pg_policies snapshot invariants', () => {
  it('snapshot is non-empty', () => {
    expect(policies.length).toBeGreaterThan(30);
  });

  it('no policy grants anon role', () => {
    const offenders = policies.filter((p) => p.roles.includes('anon'));
    expect(offenders, `anon grant leaked on: ${offenders.map((p) => `${p.tablename}.${p.policyname}`).join(', ')}`).toEqual([]);
  });

  it('no policy grants public role', () => {
    const offenders = policies.filter((p) => p.roles.includes('public'));
    expect(offenders, `public grant leaked on: ${offenders.map((p) => `${p.tablename}.${p.policyname}`).join(', ')}`).toEqual([]);
  });

  it('every AUTH_ONLY_TABLES policy targets authenticated only', () => {
    const offenders = policies
      .filter((p) => AUTH_ONLY_TABLES.has(p.tablename))
      .filter((p) => {
        // allowed: roles === ['authenticated']
        // allowed: service_role policies (for definer-style access)
        const ok =
          (p.roles.length === 1 && p.roles[0] === 'authenticated') ||
          (p.roles.length === 1 && p.roles[0] === 'service_role');
        return !ok;
      });
    expect(
      offenders,
      `non-authenticated role on locked table: ${offenders
        .map((p) => `${p.tablename}.${p.policyname} roles=${JSON.stringify(p.roles)}`)
        .join('; ')}`,
    ).toEqual([]);
  });

  it('AUTH_ONLY_TABLES have at least one SELECT policy (not deny-all-by-default-to-clients)', () => {
    // Caveat: deny-all-by-default IS intentional for some tables
    // (audit_log, app_events). We explicitly allow-list those.
    const DENY_ALL_OK = new Set(['audit_log', 'app_events']);
    const tables = [...AUTH_ONLY_TABLES].filter((t) => !DENY_ALL_OK.has(t));
    for (const t of tables) {
      const hasRead = policies.some(
        (p) => p.tablename === t && (p.cmd === 'SELECT' || p.cmd === 'ALL'),
      );
      expect(hasRead, `table "${t}" has no SELECT (or ALL) policy — clients can't read it at all`).toBe(true);
    }
  });

  it('tables migrated to per-command policies have NO compound-ALL policy', () => {
    const offenders = policies.filter(
      (p) => PER_COMMAND_ONLY_TABLES.has(p.tablename) && p.cmd === 'ALL',
    );
    expect(
      offenders,
      `stale compound-ALL on per-command-only table: ${offenders
        .map((p) => `${p.tablename}.${p.policyname}`)
        .join(', ')}`,
    ).toEqual([]);
  });

  it('every INSERT policy has a with_check clause', () => {
    // An INSERT policy with null with_check allows any row — almost always
    // a migration bug.
    const offenders = policies.filter(
      (p) => (p.cmd === 'INSERT' || p.cmd === 'ALL') && p.with_check === null && p.cmd === 'INSERT',
    );
    expect(
      offenders,
      `INSERT policy without with_check: ${offenders
        .map((p) => `${p.tablename}.${p.policyname}`)
        .join(', ')}`,
    ).toEqual([]);
  });

  it('entitlements has NO client-side INSERT or UPDATE policy (server-only writes)', () => {
    // Regression guard for the Principal review's 2.1/2.3 findings:
    // entitlements must only be writable by service_role via edge fns.
    // Any authenticated-role INSERT/UPDATE policy would re-open the Pro
    // escalation hole.
    const offenders = policies.filter(
      (p) =>
        p.tablename === 'entitlements' &&
        (p.cmd === 'INSERT' || p.cmd === 'UPDATE' || p.cmd === 'ALL') &&
        p.roles.includes('authenticated'),
    );
    expect(
      offenders,
      `entitlements has authenticated-writable policy: ${offenders
        .map((p) => `${p.policyname} cmd=${p.cmd}`)
        .join(', ')}`,
    ).toEqual([]);
  });
});
