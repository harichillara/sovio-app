import React from 'react';
import { router } from 'expo-router';
import { TabScreen, MiniActionCard, EmptyState } from '@sovio/ui';
import { useMissedMoments, useAuthStore } from '@sovio/core';

export default function ReplayTab() {
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');
  const { data: moments, isLoading } = useMissedMoments();

  const momentList = moments ?? [];

  return (
    <TabScreen
      title="Replay"
      subtitle={tier === 'free' ? 'Missed moments (last 7 days)' : 'Missed moments worth another shot'}
    >
      {momentList.length === 0 ? (
        <EmptyState
          icon="refresh-outline"
          title="Nothing missed"
          body="When you skip a plan or miss a moment, it shows up here so you can turn it into a new plan."
        />
      ) : (
        momentList.map((moment: any) => {
          const plan = moment.plans;
          return (
            <MiniActionCard
              key={moment.id}
              title={plan?.title ?? 'Missed moment'}
              body={moment.reason ?? plan?.description ?? 'Turn this into a new plan'}
              label="Convert to plan"
              onPress={() => router.push({
                pathname: '/(modals)/create-plan',
                params: { title: plan?.title, description: plan?.description },
              })}
            />
          );
        })
      )}
    </TabScreen>
  );
}
