import React from 'react';
import { TabScreen, MiniActionCard, UpgradeBanner } from '@sovio/ui';

export default function MessagesTab() {
  return (
    <TabScreen title="Messages" subtitle="Reply faster without overthinking it">
      <MiniActionCard title="Tonight group" body="3 unread. Sovio can draft a quick reply." label="Open thread" />
      <MiniActionCard title="Coffee invite" body="A low-pressure reply is ready to send." label="Use AI draft" />
      <UpgradeBanner title="Sovio Pro" body="Unlock more AI drafts and auto-reply eligibility in safe contexts." />
    </TabScreen>
  );
}
