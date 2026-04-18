import { supabase } from '../supabase/client';
import { EventTypes, trackEvent } from './events.service';

export interface AutopilotRule {
  id: string;
  user_id: string;
  key: string;
  value: string;
}

export interface AIProposal {
  id: string;
  user_id: string;
  job_type: string;
  status: string;
  result: {
    title?: string;
    summary?: string;
    assumptions?: string[];
    [key: string]: unknown;
  } | null;
  created_at: string;
}

/**
 * Get all autopilot rules for a user.
 * Rules are stored in user_preferences with keys starting with 'autopilot_'.
 */
export async function getUserRules(userId: string): Promise<AutopilotRule[]> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .like('key', 'autopilot_%');

  if (error) throw error;
  return (data ?? []) as AutopilotRule[];
}

/**
 * Set or update a single autopilot rule.
 */
export async function setRule(
  userId: string,
  ruleKey: string,
  ruleValue: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, key: ruleKey, value: ruleValue },
      { onConflict: 'user_id,key' },
    );

  if (error) throw error;
}

/**
 * Get AI-generated proposals for the user (decision type, completed).
 */
export async function getProposals(userId: string): Promise<AIProposal[]> {
  // kind='autopilot' scopes this to user-facing proposals. The merged
  // status CHECK (see 20260416195000_ai_jobs_unify) prevents queue rows
  // from having status='done', but filtering explicitly makes intent clear
  // and keeps us safe if the CHECK is ever loosened.
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'autopilot')
    .eq('job_type', 'decision')
    .eq('status', 'done')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as AIProposal[];
}

/**
 * Approve an AI proposal. Updates status and tracks event.
 *
 * Goes through the `approve_autopilot_proposal` SECURITY DEFINER RPC (added
 * in 20260417010000_rls_hardening_pt3): `ai_jobs` has no UPDATE policy for
 * clients, so direct `.from('ai_jobs').update(...)` is denied by RLS. The
 * RPC pins ownership + kind + current-status server-side and only allows
 * flipping `status` — clients cannot mutate `result` / `job_type` / `kind`.
 *
 * The `userId` parameter is retained for analytics (trackEvent) only; the
 * RPC derives the caller from auth.uid(), not from a parameter.
 */
export async function approveProposal(
  jobId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('approve_autopilot_proposal', {
    p_job_id: jobId,
  });

  if (error) {
    // Postgres P0002 = our "not found or not actionable" raise. Translate to
    // the same user-visible error shape the old path returned so callers
    // don't have to special-case.
    if (error.code === 'P0002') {
      throw new Error('Proposal not found or not owned by user');
    }
    throw error;
  }

  try {
    await trackEvent(userId, EventTypes.AUTOPILOT_APPROVED, { job_id: jobId }, 'autopilot');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Could not track autopilot approval', message);
  }
}

/**
 * Reject an AI proposal. Updates status and tracks event.
 *
 * See `approveProposal` — same RPC pattern; only `status` flips.
 */
export async function rejectProposal(
  jobId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('reject_autopilot_proposal', {
    p_job_id: jobId,
  });

  if (error) {
    if (error.code === 'P0002') {
      throw new Error('Proposal not found or not owned by user');
    }
    throw error;
  }

  try {
    await trackEvent(userId, EventTypes.AUTOPILOT_REJECTED, { job_id: jobId }, 'autopilot');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Could not track autopilot rejection', message);
  }
}
