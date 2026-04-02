import React from 'react';
import { TabScreen, HeroActionCard, MiniActionCard } from '@sovio/ui';

export default function MomentumTab() {
  return (
    <TabScreen title="Momentum" subtitle="Active plans and quick coordination">
      <HeroActionCard
        eyebrow="AVAILABLE NOW"
        title="Turn on quick matching"
        body="Let Sovio pull a simple group together if the right moment shows up."
        primaryLabel="Turn on"
        secondaryLabel="Later"
      />
      <MiniActionCard title="Tonight's easiest plan" body="One low-friction option is close and easy to lock." label="Preview" />
      <MiniActionCard title="Your active threads" body="Current plans and invites show up here." label="Open messages" />
    </TabScreen>
  );
}
