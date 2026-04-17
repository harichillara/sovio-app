import { supabase } from '../supabase/client';
import type { Plan, PlanInsert, PlanUpdate, PlanParticipant } from '../supabase/types';

interface PlanFilters {
  status?: Plan['status'];
  limit?: number;
}

export async function getPlans(userId: string, filters?: PlanFilters) {
  // Get plans where user is creator OR a participant
  let query = supabase
    .from('plans')
    .select(`
      *,
      plan_participants(user_id, status)
    `)
    .or(`creator_id.eq.${userId},plan_participants.user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPlanById(planId: string) {
  const { data, error } = await supabase
    .from('plans')
    .select(`
      *,
      plan_participants(
        *,
        profiles(*)
      )
    `)
    .eq('id', planId)
    .single();
  if (error) throw error;
  return data;
}

export async function createPlan(plan: PlanInsert): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .insert(plan)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlan(
  planId: string,
  creatorId: string,
  updates: Partial<PlanUpdate>,
): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('creator_id', creatorId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlan(planId: string, creatorId: string) {
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', planId)
    .eq('creator_id', creatorId);
  if (error) throw error;
}

export async function inviteToPlan(
  planId: string,
  userId: string,
): Promise<PlanParticipant> {
  const { data, error } = await supabase
    .from('plan_participants')
    .insert({ plan_id: planId, user_id: userId, status: 'invited' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function respondToInvite(
  planId: string,
  userId: string,
  status: PlanParticipant['status'],
) {
  const { data, error } = await supabase
    .from('plan_participants')
    .update({ status })
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSuggestedPlans(userId: string) {
  // Fetch accepted friend IDs (bidirectional relationship)
  const [{ data: asUser }, { data: asFriend }] = await Promise.all([
    supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted'),
    supabase
      .from('friendships')
      .select('user_id')
      .eq('friend_id', userId)
      .eq('status', 'accepted'),
  ]);

  const friendIds = [
    ...(asUser ?? []).map((f) => f.friend_id),
    ...(asFriend ?? []).map((f) => f.user_id),
  ];

  if (friendIds.length === 0) return [];

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('status', 'active')
    .neq('creator_id', userId)
    .in('creator_id', friendIds)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data;
}
