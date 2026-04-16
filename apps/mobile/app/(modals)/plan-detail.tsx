import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Avatar, Button, LoadingOverlay, withAlpha } from '@sovio/ui';
import { usePlan, useRespondToInvite, useAuthStore, useUpdatePlan } from '@sovio/core';

export default function PlanDetailModal() {
  const { theme } = useTheme();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: plan, isLoading } = usePlan(planId ?? '');
  const respondMutation = useRespondToInvite();
  const updatePlanMutation = useUpdatePlan();

  if (isLoading || !plan) {
    return <LoadingOverlay />;
  }

  const isCreator = plan.creator_id === userId;
  const participants = (plan as any).plan_participants ?? [];
  const myParticipation = participants.find((p: any) => p.user_id === userId);

  const statusColors: Record<string, string> = {
    accepted: theme.success,
    declined: theme.danger,
    invited: theme.accent,
    maybe: theme.muted,
  };

  const handleAccept = () => {
    if (!planId || !userId) return;
    respondMutation.mutate({ planId, userId, status: 'accepted' });
  };

  const handleDecline = () => {
    if (!planId || !userId) return;
    respondMutation.mutate({ planId, userId, status: 'declined' });
  };

  const handleCancel = () => {
    if (!planId) return;
    updatePlanMutation.mutate(
      { planId, data: { status: 'cancelled' } },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
          {plan.title}
        </Text>

        {plan.description ? (
          <Text style={{ fontSize: 15, lineHeight: 22, color: theme.muted }}>
            {plan.description}
          </Text>
        ) : null}

        {plan.location_name ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>Location</Text>
            <Text style={{ color: theme.text, fontSize: 14 }}>{plan.location_name}</Text>
          </View>
        ) : null}

        {plan.scheduled_at ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>When</Text>
            <Text style={{ color: theme.text, fontSize: 14 }}>
              {new Date(plan.scheduled_at).toLocaleString()}
            </Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
            Participants
          </Text>
          {participants.length === 0 ? (
            <Text style={{ color: theme.muted, fontSize: 14 }}>No participants yet</Text>
          ) : (
            participants.map((p: any) => {
              const profile = p.profiles;
              return (
                <View key={p.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar
                    uri={profile?.avatar_url}
                    name={profile?.display_name ?? 'User'}
                    size={36}
                  />
                  <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
                    {profile?.display_name ?? 'Unknown'}
                  </Text>
                  <View style={{
                    backgroundColor: withAlpha(statusColors[p.status] ?? theme.muted, 0.13),
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}>
                    <Text style={{ color: statusColors[p.status] ?? theme.muted, fontSize: 12, fontWeight: '700' }}>
                      {p.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {isCreator ? (
          <View style={{ gap: 10 }}>
            <Button label="Edit Plan" onPress={() => {}} variant="secondary" />
            <Button
              label={updatePlanMutation.isPending ? 'Cancelling...' : 'Cancel Plan'}
              onPress={handleCancel}
              variant="secondary"
            />
          </View>
        ) : myParticipation && myParticipation.status === 'invited' ? (
          <View style={{ gap: 10 }}>
            <Button label="Accept" onPress={handleAccept} />
            <Button label="Decline" onPress={handleDecline} variant="secondary" />
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
