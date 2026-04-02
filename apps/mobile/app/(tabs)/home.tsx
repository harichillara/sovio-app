import React from 'react';
import { TabScreen, HeroActionCard, MiniActionCard, TokenMeter, UpgradeBanner } from '@sovio/ui';

export default function HomeTab() {
  return (
    <TabScreen title="Home" subtitle="Tonight looks easy" headerRight={<TokenMeter used={32} total={100} />}>
      <HeroActionCard
        eyebrow="READY NOW"
        title="One quick plan is ready"
        body="Coffee, short walk, and one invite. Low effort. Easy yes."
        primaryLabel="Do it"
        secondaryLabel="Not now"
      />
      <MiniActionCard title="Text two friends" body="Sovio already drafted the opener. You just send it." label="Open messages" />
      <MiniActionCard title="Try a nearby spot" body="A simple option within 12 minutes is open tonight." label="See option" />
      <UpgradeBanner title="Need more AI help?" body="Sovio Pro unlocks more suggestions, faster drafts, and priority plan generation." />
    </TabScreen>
  );
}
