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
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('job_type', 'decision')
    .eq('status', 'done')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as AIProposal[];
}

/**
 * Approve an AI proposal. Updates status and tracks event.
 *
 * SECURITY: Both jobId AND userId are required in the WHERE clause
 * to prevent one user from mutating another user's proposals.
 * Even with RLS, this defense-in-depth ensures ownership at the app layer.
 */
export async function approveProposal(
  jobId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('ai_jobs')
    .update({ status: 'approved' })
    .eq('id', jobId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Proposal not found or not owned by user');

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
 * SECURITY: Both jobId AND userId are required in the WHERE clause.
 */
export async function rejectProposal(
  jobId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('ai_jobs')
    .update({ status: 'rejected' })
    .eq('id', jobId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Proposal not found or not owned by user');

  try {
    await trackEvent(userId, EventTypes.AUTOPILOT_REJECTED, { job_id: jobId }, 'autopilot');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Could not track autopilot rejection', message);
  }
}
