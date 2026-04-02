import { supabase } from '../supabase/client';

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
 */
export async function approveProposal(
  jobId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ai_jobs')
    .update({ status: 'approved' })
    .eq('id', jobId);

  if (error) throw error;

  // Track the event
  await supabase
    .from('analytics_events')
    .insert({
      user_id: userId,
      event: 'proposal_approved',
      metadata: { job_id: jobId },
    })
    .then(() => {});
}

/**
 * Reject an AI proposal. Updates status and tracks event.
 */
export async function rejectProposal(
  jobId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ai_jobs')
    .update({ status: 'rejected' })
    .eq('id', jobId);

  if (error) throw error;

  // Track the event
  await supabase
    .from('analytics_events')
    .insert({
      user_id: userId,
      event: 'proposal_rejected',
      metadata: { job_id: jobId },
    })
    .then(() => {});
}
