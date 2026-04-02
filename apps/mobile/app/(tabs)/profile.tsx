import React from 'react';
import { TabScreen, MiniActionCard, UpgradeBanner, ThemeToggle } from '@sovio/ui';

export default function ProfileTab() {
  return (
    <TabScreen title="Profile" subtitle="Control, trust, and settings">
      <ThemeToggle />
      <MiniActionCard title="Sovio Score" body="You've had more real-world momentum this week than last week." label="View details" />
      <MiniActionCard title="AI settings" body="Manage drafts, auto-reply, and personalization." label="Open settings" />
      <MiniActionCard title="Privacy and support" body="Permissions, exports, delete account, and help." label="Manage" />
      <UpgradeBanner title="Upgrade to Sovio Pro" body="Get more AI credits, faster coordination, and deeper insights." />
    </TabScreen>
  );
}
