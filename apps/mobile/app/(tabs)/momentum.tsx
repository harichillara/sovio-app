import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import {
  TabScreen,
  AvailableToggle,
  MiniActionCard,
  EmptyState,
} from '@sovio/ui';
import {
  useMyAvailability,
  useSetAvailable,
  useRemoveAvailability,
  usePlans,
  useAuthStore,
  useFriends,
} from '@sovio/core';

export default function MomentumTab() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);

  // Momentum availability
  const { data: availability } = useMyAvailability();
  const setAvailable = useSetAvailable();
  const removeAvailability = useRemoveAvailability();
  const isAvailable = !!availability;

  // Active plans
  const { data: plans } = usePlans({ status: 'active' });
  const activePlans = plans ?? [];

  // Friends for safety indicator
  const { data: friends } = useFriends();
  const friendCount = friends?.length ?? 0;

  const handleToggle = useCallback(
    (next: boolean) => {
      if (next) {
        // Default: 60 min, general category, local bucket
        setAvailable.mutate({
          bucket: 'local', // In production, use geo-hash from location service
          category: null,
          durationMins: 60,
        });
      } else {
        removeAvailability.mutate();
      }
    },
    [setAvailable, removeAvailability],
  );

  return (
    <TabScreen title="Momentum" subtitle="Spontaneous coordination">
      {/* Availability toggle */}
      <AvailableToggle
        isAvailable={isAvailable}
        onToggle={handleToggle}
        category={availability?.category ?? undefined}
        expiresAt={availability?.available_until ?? null}
      />

      {/* Safety indicator */}
      {isAvailable && (
        <View style={[styles.safetyRow, { backgroundColor: theme.surfaceAlt }]}>
          <Text style={[styles.safetyText, { color: theme.muted }]}>
            {friendCount} mutual friend{friendCount !== 1 ? 's' : ''} nearby
          </Text>
        </View>
      )}

      {/* Active plans */}
      {activePlans.length === 0 ? (
        <EmptyState
          icon="flash-outline"
          title="No active momentum"
          body="Toggle available above or create a plan to get started. Friends who are also available will appear here."
          actionLabel="Create a plan"
          onAction={() => router.push('/(modals)/create-plan')}
        />
      ) : (
        <View style={styles.planList}>
          {activePlans.map((plan) => (
            <MiniActionCard
              key={plan.id}
              title={plan.title}
              body={plan.description ?? 'Tap to see details'}
              label={
                plan.scheduled_at
                  ? new Date(plan.scheduled_at).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Flexible'
              }
              onPress={() =>
                router.push({
                  pathname: '/(modals)/plan-detail',
                  params: { planId: plan.id },
                })
              }
            />
          ))}
        </View>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  safetyRow: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  safetyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  planList: {
    gap: 10,
  },
});
