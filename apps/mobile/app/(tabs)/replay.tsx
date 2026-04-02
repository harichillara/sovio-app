import React from 'react';
import { TabScreen, MiniActionCard } from '@sovio/ui';

export default function ReplayTab() {
  return (
    <TabScreen title="Replay" subtitle="Missed moments worth another shot">
      <MiniActionCard title="You skipped a nearby live set" body="Turn it into tomorrow night's plan in one tap." label="Convert to plan" />
      <MiniActionCard title="A friend was out nearby" body="Sovio can help restart the momentum." label="Reach out" />
    </TabScreen>
  );
}
