import React from 'react';
import { router } from 'expo-router';
import { TabScreen, MiniActionCard, EmptyState } from '@sovio/ui';
import { usePlans } from '@sovio/core';

export default function MomentumTab() {
  const { data: plans, isLoading } = usePlans({ status: 'active' });

  const activePlans = plans ?? [];

  return (
    <TabScreen title="Momentum" subtitle="Active plans and quick coordination">
      {activePlans.length === 0 ? (
        <EmptyState
          icon="flash-outline"
          title="No active plans"
          body="When you create or join a plan, it shows up here for quick coordination."
          actionLabel="Create a plan"
          onAction={() => router.push('/(modals)/create-plan')}
        />
      ) : (
        activePlans.map((plan) => (
          <MiniActionCard
            key={plan.id}
            title={plan.title}
            body={plan.description ?? 'Tap to see details'}
            label={plan.scheduled_at
              ? new Date(plan.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              : 'No date set'
            }
            onPress={() => router.push({ pathname: '/(modals)/plan-detail', params: { planId: plan.id } })}
          />
        ))
      )}
    </TabScreen>
  );
}
