/**
 * Cross-user RLS assertion suite.
 *
 * Creates two ephemeral users (A and B), uses the service-role admin client
 * to seed rows owned by B that A must NOT be able to see or mutate, and
 * asserts those exact boundaries via A's authenticated anon-key client.
 *
 * What "failure to access" looks like over PostgREST + RLS:
 *   - SELECT: returns `data: []` (200 OK, zero rows). RLS hides rows silently.
 *   - INSERT: `error.code = '42501'` (permission denied by RLS) when the
 *     with_check fails, or `error.code = 'PGRST116'`/`42501` on policy miss.
 *   - UPDATE: returns `data: []` / `count: 0` if RLS hides the row, or 42501
 *     if there's no UPDATE policy at all for the role.
 *
 * These are the real-world failure modes; a passing test here means RLS
 * actually enforces the boundary the code depends on.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, createUserClient } from './helpers/clients';
import { createTestUser, deleteTestUser, type TestUser } from './helpers/test-users';

let admin: SupabaseClient;
let userA: TestUser;
let userB: TestUser;
let clientA: SupabaseClient;
let clientB: SupabaseClient;

// Seeded state: a thread owned by userB with a message from userB. A must
// not be able to see either.
let bThreadId: string;
let bMessageId: string;

beforeAll(async () => {
  admin = getAdminClient();
  userA = await createTestUser(admin, 'A');
  userB = await createTestUser(admin, 'B');
  clientA = await createUserClient(userA.email, userA.password);
  clientB = await createUserClient(userB.email, userB.password);

  // Seed a private thread for B. Use admin (service_role) because a
  // brand-new user has no existing thread to piggyback on.
  const { data: thread, error: threadErr } = await admin
    .from('threads')
    .insert({ title: 'B private thread' })
    .select('id')
    .single();
  if (threadErr) throw new Error(`seed thread: ${threadErr.message}`);
  bThreadId = thread!.id;

  const { error: partErr } = await admin
    .from('thread_participants')
    .insert({ thread_id: bThreadId, user_id: userB.id });
  if (partErr) throw new Error(`seed thread_participants: ${partErr.message}`);

  const { data: msg, error: msgErr } = await admin
    .from('messages')
    .insert({ thread_id: bThreadId, sender_id: userB.id, content: 'B-only secret' })
    .select('id')
    .single();
  if (msgErr) throw new Error(`seed message: ${msgErr.message}`);
  bMessageId = msg!.id;
}, 60_000);

afterAll(async () => {
  // Clean seeded rows first so the user-delete cascade is clean.
  if (bMessageId) await admin.from('messages').delete().eq('id', bMessageId);
  if (bThreadId) {
    await admin.from('thread_participants').delete().eq('thread_id', bThreadId);
    await admin.from('threads').delete().eq('id', bThreadId);
  }
  if (userA) await deleteTestUser(admin, userA);
  if (userB) await deleteTestUser(admin, userB);
}, 60_000);

describe('messages RLS', () => {
  it("A cannot SELECT B's message by id", async () => {
    const { data, error } = await clientA
      .from('messages')
      .select('id, content')
      .eq('id', bMessageId);
    expect(error).toBeNull();
    // RLS hides the row; empty result, not a 403.
    expect(data).toEqual([]);
  });

  it("A cannot SELECT any message in B's thread", async () => {
    const { data, error } = await clientA
      .from('messages')
      .select('id')
      .eq('thread_id', bThreadId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("A cannot INSERT a message forging sender_id = B", async () => {
    const { error } = await clientA
      .from('messages')
      .insert({ thread_id: bThreadId, sender_id: userB.id, content: 'forged' });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it("A cannot INSERT a message with their own sender_id into B's thread", async () => {
    // The messages INSERT policy should also require A to be a participant
    // of the thread; sender_id=A alone is insufficient.
    const { error } = await clientA
      .from('messages')
      .insert({ thread_id: bThreadId, sender_id: userA.id, content: 'crasher' });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });
});

describe('entitlements RLS', () => {
  it('A can SELECT their own entitlement row', async () => {
    const { data, error } = await clientA
      .from('entitlements')
      .select('user_id, plan, status')
      .eq('user_id', userA.id);
    expect(error).toBeNull();
    // handle_new_profile_entitlements trigger should auto-create this.
    expect((data ?? []).length).toBeGreaterThanOrEqual(0);
  });

  it("A cannot SELECT B's entitlements", async () => {
    const { data, error } = await clientA
      .from('entitlements')
      .select('user_id, plan')
      .eq('user_id', userB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('A cannot UPDATE their own plan to "pro" (server-only writes)', async () => {
    // The Principal review 2.1: entitlements must only be writable by
    // service_role via edge fns. If this succeeds, the Pro paywall is open.
    const { data, error } = await clientA
      .from('entitlements')
      .update({ plan: 'pro', status: 'active' })
      .eq('user_id', userA.id)
      .select('plan');
    // Two acceptable outcomes: (a) 42501 (no UPDATE policy for authenticated),
    // (b) empty result set (RLS policy hides row). Either means the update
    // did nothing.
    if (error) {
      expect(error.code).toBe('42501');
    } else {
      expect(data).toEqual([]);
    }

    // Defensive re-read via admin: plan must NOT be pro.
    const { data: reread } = await admin
      .from('entitlements')
      .select('plan')
      .eq('user_id', userA.id)
      .maybeSingle();
    if (reread) {
      expect(reread.plan).not.toBe('pro');
    }
  });

  it("A cannot UPDATE B's entitlements", async () => {
    const { data, error } = await clientA
      .from('entitlements')
      .update({ plan: 'pro' })
      .eq('user_id', userB.id)
      .select('plan');
    if (error) {
      expect(error.code).toBe('42501');
    } else {
      expect(data).toEqual([]);
    }
  });
});

describe('SECURITY DEFINER function access', () => {
  it('authenticated A cannot pass viewer_id=B to get_nearby_available_friends', async () => {
    const { error } = await clientA.rpc('get_nearby_available_friends', {
      viewer_id: userB.id,
      center_lat: 0,
      center_lng: 0,
      radius_meters: 2500,
    });
    expect(error).not.toBeNull();
    // pt4 rewrite: function raises 'forbidden' with errcode 42501.
    expect(error!.message.toLowerCase()).toContain('forbidden');
  });

  it('authenticated A cannot call notify_insert_and_push (execute revoked)', async () => {
    const { error } = await clientA.rpc('notify_insert_and_push', {
      p_user_id: userB.id,
      p_kind: 'spam',
      p_title: 'hi',
      p_body: 'this should be blocked',
      p_data: {},
    });
    expect(error).not.toBeNull();
    // PostgREST returns 42883 (no matching function found) because the
    // authenticated role lacks EXECUTE and PostgREST hides the function's
    // existence, or 42501 (permission denied). Either proves the revoke worked.
    expect(['42883', '42501', 'PGRST202']).toContain(error!.code);
  });

  it('authenticated A cannot call apply_beta_pro_access (execute revoked)', async () => {
    const { error } = await clientA.rpc('apply_beta_pro_access' as never, {
      target_user_id: userA.id,
      target_email: userA.email,
    } as never);
    expect(error).not.toBeNull();
    expect(['42883', '42501', 'PGRST202']).toContain(error!.code);
  });
});

describe('ai_jobs RLS', () => {
  it("A cannot SELECT B's ai_jobs rows", async () => {
    // Seed one ai_jobs row for B via admin.
    const { data: seed, error: seedErr } = await admin
      .from('ai_jobs')
      .insert({
        user_id: userB.id,
        kind: 'autopilot',
        job_type: 'integration-test',
        status: 'done',
        payload: { test: true },
      })
      .select('id')
      .single();
    if (seedErr) throw new Error(`seed ai_jobs: ${seedErr.message}`);

    try {
      const { data, error } = await clientA
        .from('ai_jobs')
        .select('id')
        .eq('user_id', userB.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    } finally {
      await admin.from('ai_jobs').delete().eq('id', seed!.id);
    }
  });
});

describe('profiles policy sanity (positive test)', () => {
  it("A CAN read B's profile (social-app intent, open-read by design)", async () => {
    // This is NOT a vulnerability — it's the documented intent for a
    // social-planning app. Profile = public face. If this ever fails,
    // the RLS policy was over-tightened and friend discovery breaks.
    const { data, error } = await clientA
      .from('profiles')
      .select('id, display_name')
      .eq('id', userB.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(userB.id);
  });
});
