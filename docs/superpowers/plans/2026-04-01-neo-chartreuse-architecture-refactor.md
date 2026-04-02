# Neo Chartreuse Architecture Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the purple palette with Neo Chartreuse, eliminate all prop drilling and redundancy, split the UI monolith into focused files, and add shared style/template abstractions.

**Architecture:** Components consume theme via `useTheme()` context internally (no `theme` prop). Shared `createStyles(theme)` factory produces named StyleSheet entries. `TabScreen` template handles the AppScreen+AppHeader+ScrollView boilerplate shared by all 5 tab screens. Web pages consume tokens via CSS custom properties.

**Tech Stack:** React Native, Expo SDK 51, Expo Router v3, Next.js 14, TypeScript, pnpm workspaces

---

## File Map

### Create
- `packages/tokens/src/themes.ts` — Neo Chartreuse light + dark theme objects
- `packages/tokens/src/css.ts` — cssVars() helper for web
- `packages/ui/src/types.ts` — all component prop interfaces (no theme prop)
- `packages/ui/src/styles.ts` — createStyles(theme) shared StyleSheet factory
- `packages/ui/src/AppScreen.tsx` — screen wrapper component
- `packages/ui/src/AppHeader.tsx` — dual-line header component
- `packages/ui/src/HeroActionCard.tsx` — large action card
- `packages/ui/src/MiniActionCard.tsx` — small action card
- `packages/ui/src/PillChip.tsx` — toggle pill
- `packages/ui/src/UpgradeBanner.tsx` — pro upsell card
- `packages/ui/src/TokenMeter.tsx` — AI usage bar
- `packages/ui/src/StepProgress.tsx` — step indicator
- `packages/ui/src/Button.tsx` — primary/secondary variant button
- `packages/ui/src/TabScreen.tsx` — tab screen template
- `packages/ui/src/ThemeToggle.tsx` — dark/light toggle widget

### Modify
- `packages/tokens/src/index.ts` — re-export from themes.ts instead of inline definitions
- `packages/tokens/src/ThemeContext.tsx` — import from themes.ts
- `packages/ui/src/index.tsx` — barrel re-exports only
- `apps/mobile/app/_layout.tsx` — simplified
- `apps/mobile/app/index.tsx` — no theme drilling, use context-aware components
- `apps/mobile/app/onboarding.tsx` — no theme drilling
- `apps/mobile/app/(tabs)/_layout.tsx` — use new palette tokens
- `apps/mobile/app/(tabs)/home.tsx` — use TabScreen, no theme drilling
- `apps/mobile/app/(tabs)/momentum.tsx` — use TabScreen
- `apps/mobile/app/(tabs)/messages.tsx` — use TabScreen
- `apps/mobile/app/(tabs)/replay.tsx` — use TabScreen
- `apps/mobile/app/(tabs)/profile.tsx` — use TabScreen + ThemeToggle
- `apps/web/app/layout.tsx` — use cssVars
- `apps/web/app/page.tsx` — use CSS variables
- `apps/web/app/pricing/page.tsx` — use CSS variables
- `docs/brand/SOVIO_BRAND_SYSTEM.md` — update accent color reference

### Delete
- `docs/updates/APPLY_THESE_UPDATES.md`
- `docs/updates/FILE_MANIFEST.json`

---

## Task 1: Neo Chartreuse Tokens

**Files:**
- Create: `packages/tokens/src/themes.ts`
- Modify: `packages/tokens/src/types.ts`
- Modify: `packages/tokens/src/index.ts`
- Modify: `packages/tokens/src/ThemeContext.tsx`

- [ ] **Step 1: Create themes.ts with Neo Chartreuse palette**

```ts
// packages/tokens/src/themes.ts
import type { SovioTheme } from './types';

export const lightTheme: SovioTheme = {
  background: '#F8FFF0',
  surface: '#FFFFFF',
  surfaceAlt: '#EEFFD6',
  text: '#0D1A00',
  muted: '#5A7030',
  accent: '#BDFF2E',
  accentSoft: '#8ACC00',
  success: '#00D1A0',
  danger: '#FF5A7A',
  border: '#D6EEAA',
};

export const darkTheme: SovioTheme = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceAlt: '#1A2A0A',
  text: '#F0FFD0',
  muted: '#8A9A5E',
  accent: '#BDFF2E',
  accentSoft: '#8ACC00',
  success: '#25D9A6',
  danger: '#FF6F8F',
  border: '#2A3A1A',
};
```

- [ ] **Step 2: Update index.ts to re-export from themes.ts**

```ts
// packages/tokens/src/index.ts
export type { SovioTheme } from './types';
export { lightTheme, darkTheme } from './themes';
```

- [ ] **Step 3: Update ThemeContext.tsx to import from themes.ts**

```ts
// packages/tokens/src/ThemeContext.tsx
import React, { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { lightTheme, darkTheme } from './themes';
import type { SovioTheme } from './types';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: SovioTheme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  const value = useMemo<ThemeContextValue>(() => ({
    theme: mode === 'light' ? lightTheme : darkTheme,
    mode,
    toggleTheme: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
    setMode,
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

Note: default mode changed to `'dark'` since Neo Chartreuse is dark-mode-first.

- [ ] **Step 4: Create CSS vars helper for web**

```ts
// packages/tokens/src/css.ts
import type { SovioTheme } from './types';

export function cssVars(theme: SovioTheme): Record<string, string> {
  return Object.fromEntries(
    Object.entries(theme).map(([k, v]) => [`--sovio-${k}`, v])
  );
}
```

---

## Task 2: Shared Styles Factory + Types

**Files:**
- Create: `packages/ui/src/types.ts`
- Create: `packages/ui/src/styles.ts`

- [ ] **Step 1: Create types.ts with all component interfaces**

```ts
// packages/ui/src/types.ts
import type { ReactNode } from 'react';

export interface AppScreenProps {
  children: ReactNode;
}

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export interface HeroActionCardProps {
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel?: string;
  eyebrow?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export interface MiniActionCardProps {
  title: string;
  body: string;
  label: string;
  onPress?: () => void;
}

export interface PillChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export interface UpgradeBannerProps {
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
}

export interface TokenMeterProps {
  used: number;
  total: number;
}

export interface StepProgressProps {
  current: number;
  total: number;
}

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

export interface TabScreenProps {
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

export interface ThemeToggleProps {}
```

- [ ] **Step 2: Create styles.ts shared StyleSheet factory**

```ts
// packages/ui/src/styles.ts
import { StyleSheet } from 'react-native';
import type { SovioTheme } from '@sovio/tokens';

export function createStyles(theme: SovioTheme) {
  return StyleSheet.create({
    // Cards
    heroCard: { backgroundColor: theme.surface, borderRadius: 28, padding: 22, gap: 12 },
    miniCard: { backgroundColor: theme.surface, borderRadius: 22, padding: 18, gap: 10 },
    invertedCard: { backgroundColor: theme.accent, borderRadius: 24, padding: 18, gap: 8 },

    // Text presets
    heading: { color: theme.text, fontSize: 28, fontWeight: '800' },
    title: { color: theme.text, fontSize: 24, fontWeight: '800' },
    subtitle: { color: theme.text, fontSize: 18, fontWeight: '700' },
    body: { color: theme.muted, fontSize: 15, lineHeight: 22 },
    bodySmall: { color: theme.muted, fontSize: 14, lineHeight: 20 },
    label: { color: theme.accent, fontSize: 13, fontWeight: '700' },
    eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1 },

    // Buttons
    btnPrimary: { backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 18 },
    btnSecondary: { backgroundColor: theme.surfaceAlt, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 18 },
    btnTextOnAccent: { color: theme.background, fontWeight: '800', textAlign: 'center' as const },
    btnTextOnSurface: { color: theme.text, fontWeight: '800', textAlign: 'center' as const },

    // Shapes
    pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
    progressSegment: { height: 6, borderRadius: 999 },

    // Layout
    scrollContent: { gap: 14, paddingBottom: 22 },
    rowBtns: { flexDirection: 'row' as const, gap: 10, marginTop: 6 },
  });
}
```

---

## Task 3: Split UI Components

**Files:**
- Create: `packages/ui/src/AppScreen.tsx`
- Create: `packages/ui/src/AppHeader.tsx`
- Create: `packages/ui/src/Button.tsx`
- Create: `packages/ui/src/HeroActionCard.tsx`
- Create: `packages/ui/src/MiniActionCard.tsx`
- Create: `packages/ui/src/PillChip.tsx`
- Create: `packages/ui/src/UpgradeBanner.tsx`
- Create: `packages/ui/src/TokenMeter.tsx`
- Create: `packages/ui/src/StepProgress.tsx`
- Create: `packages/ui/src/TabScreen.tsx`
- Create: `packages/ui/src/ThemeToggle.tsx`
- Modify: `packages/ui/src/index.tsx`

- [ ] **Step 1: Create AppScreen.tsx**

```tsx
// packages/ui/src/AppScreen.tsx
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { AppScreenProps } from './types';

export function AppScreen({ children }: AppScreenProps) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 20, paddingTop: 56 }}>
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Create AppHeader.tsx**

```tsx
// packages/ui/src/AppHeader.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { AppHeaderProps } from './types';

export function AppHeader({ title, subtitle, rightSlot }: AppHeaderProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={s.heading}>{title}</Text>
        {subtitle ? <Text style={[s.bodySmall, { marginTop: 6 }]}>{subtitle}</Text> : null}
      </View>
      {rightSlot}
    </View>
  );
}
```

- [ ] **Step 3: Create Button.tsx (merged primary + secondary)**

```tsx
// packages/ui/src/Button.tsx
import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { ButtonProps } from './types';

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const isPrimary = variant === 'primary';
  return (
    <Pressable onPress={onPress} style={isPrimary ? s.btnPrimary : s.btnSecondary}>
      <Text style={isPrimary ? s.btnTextOnAccent : s.btnTextOnSurface}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Create HeroActionCard.tsx**

```tsx
// packages/ui/src/HeroActionCard.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import { Button } from './Button';
import type { HeroActionCardProps } from './types';

export function HeroActionCard({ title, body, primaryLabel, secondaryLabel, eyebrow, onPrimary, onSecondary }: HeroActionCardProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <View style={s.heroCard}>
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      <View style={s.rowBtns}>
        <Button label={primaryLabel} onPress={onPrimary || (() => {})} />
        {secondaryLabel ? <Button label={secondaryLabel} onPress={onSecondary || (() => {})} variant="secondary" /> : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Create MiniActionCard.tsx**

```tsx
// packages/ui/src/MiniActionCard.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { MiniActionCardProps } from './types';

export function MiniActionCard({ title, body, label, onPress }: MiniActionCardProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const content = (
    <View style={s.miniCard}>
      <Text style={s.subtitle}>{title}</Text>
      <Text style={s.bodySmall}>{body}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}
```

- [ ] **Step 6: Create PillChip.tsx**

```tsx
// packages/ui/src/PillChip.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { PillChipProps } from './types';

export function PillChip({ label, selected = false, onPress }: PillChipProps) {
  const { theme } = useTheme();
  const chip = (
    <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: selected ? theme.accent : theme.surfaceAlt }}>
      <Text style={{ color: selected ? theme.background : theme.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{chip}</Pressable>;
  return chip;
}
```

- [ ] **Step 7: Create UpgradeBanner.tsx**

```tsx
// packages/ui/src/UpgradeBanner.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { UpgradeBannerProps } from './types';

export function UpgradeBanner({ title, body, cta = 'Upgrade', onPress }: UpgradeBannerProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const content = (
    <View style={s.invertedCard}>
      <Text style={{ color: theme.background, fontWeight: '800', fontSize: 18 }}>{title}</Text>
      <Text style={{ color: theme.surfaceAlt, fontSize: 14, lineHeight: 20 }}>{body}</Text>
      <Text style={{ color: theme.background, fontWeight: '800', fontSize: 14 }}>{cta} →</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}
```

- [ ] **Step 8: Create TokenMeter.tsx**

```tsx
// packages/ui/src/TokenMeter.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { TokenMeterProps } from './types';

export function TokenMeter({ used, total }: TokenMeterProps) {
  const { theme } = useTheme();
  const pct = Math.max(0, Math.min(100, (used / total) * 100));
  return (
    <View style={{ alignItems: 'flex-end', gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>AI</Text>
      <View style={{ width: 72, height: 8, borderRadius: 999, backgroundColor: theme.border, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: theme.accent, borderRadius: 999 }} />
      </View>
    </View>
  );
}
```

- [ ] **Step 9: Create StepProgress.tsx**

```tsx
// packages/ui/src/StepProgress.tsx
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { StepProgressProps } from './types';

export function StepProgress({ current, total }: StepProgressProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.progressSegment, { flex: 1, backgroundColor: i < current ? theme.accent : theme.border }]} />
      ))}
    </View>
  );
}
```

- [ ] **Step 10: Create TabScreen.tsx template**

```tsx
// packages/ui/src/TabScreen.tsx
import React from 'react';
import { ScrollView } from 'react-native';
import { createStyles } from './styles';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen } from './AppScreen';
import { AppHeader } from './AppHeader';
import type { TabScreenProps } from './types';

export function TabScreen({ title, subtitle, headerRight, children }: TabScreenProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <AppScreen>
      <AppHeader title={title} subtitle={subtitle} rightSlot={headerRight} />
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </AppScreen>
  );
}
```

- [ ] **Step 11: Create ThemeToggle.tsx**

```tsx
// packages/ui/src/ThemeToggle.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@sovio/tokens/ThemeContext';

export function ThemeToggle() {
  const { theme, mode, toggleTheme } = useTheme();
  return (
    <Pressable
      onPress={toggleTheme}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.surface,
        borderRadius: 22,
        padding: 18,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={20} color={theme.accent} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
          {mode === 'dark' ? 'Dark mode' : 'Light mode'}
        </Text>
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: mode === 'dark' ? theme.accent : theme.border, justifyContent: 'center', paddingHorizontal: 3 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: mode === 'dark' ? theme.background : theme.surface, alignSelf: mode === 'dark' ? 'flex-end' : 'flex-start' }} />
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 12: Rewrite index.tsx as barrel re-exports**

```tsx
// packages/ui/src/index.tsx
export { AppScreen } from './AppScreen';
export { AppHeader } from './AppHeader';
export { HeroActionCard } from './HeroActionCard';
export { MiniActionCard } from './MiniActionCard';
export { PillChip } from './PillChip';
export { UpgradeBanner } from './UpgradeBanner';
export { TokenMeter } from './TokenMeter';
export { StepProgress } from './StepProgress';
export { Button } from './Button';
export { TabScreen } from './TabScreen';
export { ThemeToggle } from './ThemeToggle';
export type * from './types';
```

---

## Task 4: Update Mobile App Screens

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/app/onboarding.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/home.tsx`
- Modify: `apps/mobile/app/(tabs)/momentum.tsx`
- Modify: `apps/mobile/app/(tabs)/messages.tsx`
- Modify: `apps/mobile/app/(tabs)/replay.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Update _layout.tsx (root)**

```tsx
// apps/mobile/app/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@sovio/tokens/ThemeContext';

function InnerLayout() {
  const { mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Update index.tsx (entry screen)**

```tsx
// apps/mobile/app/index.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, HeroActionCard, Button } from '@sovio/ui';

export default function EntryScreen() {
  const { theme } = useTheme();
  return (
    <AppScreen>
      <View style={{ gap: 18, flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: theme.text }}>Sovio</Text>
        <HeroActionCard
          eyebrow="WELCOME"
          title="Stop scrolling. Start doing."
          body="Sovio helps you make real plans faster with smart suggestions, lighter planning, and less effort."
          primaryLabel="Get started"
          secondaryLabel="Skip to app"
          onPrimary={() => router.push('/onboarding')}
          onSecondary={() => router.push('/(tabs)/home')}
        />
        <Button label="Open Sovio" onPress={() => router.push('/(tabs)/home')} />
      </View>
    </AppScreen>
  );
}
```

- [ ] **Step 3: Update onboarding.tsx**

```tsx
// apps/mobile/app/onboarding.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppHeader, AppScreen, PillChip, Button, StepProgress } from '@sovio/ui';
import { interestOptions, socialPreferenceOptions } from '@sovio/core';

const steps = ['Welcome', 'Interests', 'Social', 'AI', 'Notifications', 'Location', 'Finish'];

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);

  const toggleInterest = useCallback((item: string) => {
    setSelectedInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }, []);

  const togglePreference = useCallback((item: string) => {
    setSelectedPreferences((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }, []);

  const content = useMemo(() => {
    switch (step) {
      case 0: return { title: 'Stop scrolling. Start doing.', body: 'Sovio helps you make real plans faster.' };
      case 1: return { title: 'What are you into lately?', body: 'Pick a few to personalize your first suggestions.' };
      case 2: return { title: 'What feels right most days?', body: 'This helps Sovio shape the tone of your suggestions.' };
      case 3: return { title: 'Want AI help with planning and replies?', body: 'You stay in control. AI helps make planning easier.' };
      case 4: return { title: "Only notify me when it's worth it", body: 'Sovio sends useful nudges, not noise.' };
      case 5: return { title: 'Find things near me', body: 'Location helps Sovio show better options and faster plans.' };
      default: return { title: "You're in", body: 'Sovio is ready with your first set of ideas.' };
    }
  }, [step]);

  return (
    <AppScreen>
      <AppHeader title="Sovio" subtitle="Set up your first experience" />
      <StepProgress current={step + 1} total={steps.length} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: theme.text }}>{content.title}</Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: theme.muted }}>{content.body}</Text>

        {step === 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {interestOptions.map((item) => (
              <PillChip key={item} label={item} selected={selectedInterests.includes(item)} onPress={() => toggleInterest(item)} />
            ))}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {socialPreferenceOptions.map((item) => (
              <PillChip key={item} label={item} selected={selectedPreferences.includes(item)} onPress={() => togglePreference(item)} />
            ))}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 12 }}>
            <Button label="Turn on AI help" onPress={() => setStep(step + 1)} />
            <Button label="Maybe later" onPress={() => setStep(step + 1)} variant="secondary" />
          </View>
        ) : null}

        {step === 4 ? <Button label="Enable notifications" onPress={() => setStep(step + 1)} /> : null}
        {step === 5 ? <Button label="Enable location" onPress={() => setStep(step + 1)} /> : null}
      </ScrollView>

      <View style={{ marginTop: 20, gap: 10 }}>
        {step < steps.length - 1 ? (
          <Button label="Continue" onPress={() => setStep(step + 1)} />
        ) : (
          <Button label="Open Sovio" onPress={() => router.replace('/(tabs)/home')} />
        )}
        {step > 0 && step < steps.length - 1 ? (
          <Button label="Back" onPress={() => setStep(step - 1)} variant="secondary" />
        ) : null}
      </View>
    </AppScreen>
  );
}
```

- [ ] **Step 4: Update (tabs)/_layout.tsx**

```tsx
// apps/mobile/app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@sovio/tokens/ThemeContext';

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  home: { active: 'home', inactive: 'home-outline' },
  momentum: { active: 'flash', inactive: 'flash-outline' },
  messages: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  replay: { active: 'refresh', inactive: 'refresh-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: { fontWeight: '800', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name] || TAB_ICONS.home;
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="momentum" options={{ title: 'Momentum' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="replay" options={{ title: 'Replay' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

- [ ] **Step 5: Update home.tsx**

```tsx
// apps/mobile/app/(tabs)/home.tsx
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
```

- [ ] **Step 6: Update momentum.tsx**

```tsx
// apps/mobile/app/(tabs)/momentum.tsx
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
```

- [ ] **Step 7: Update messages.tsx**

```tsx
// apps/mobile/app/(tabs)/messages.tsx
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
```

- [ ] **Step 8: Update replay.tsx**

```tsx
// apps/mobile/app/(tabs)/replay.tsx
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
```

- [ ] **Step 9: Update profile.tsx**

```tsx
// apps/mobile/app/(tabs)/profile.tsx
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
```

---

## Task 5: Update Web App

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/pricing/page.tsx`

- [ ] **Step 1: Update layout.tsx with CSS token variables**

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from 'next';
import { cssVars } from '@sovio/tokens/css';
import { darkTheme } from '@sovio/tokens';

export const metadata: Metadata = {
  title: 'Sovio — Plans, without the effort',
  description: 'Sovio turns "we should do something" into an actual plan.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const vars = cssVars(darkTheme);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif', ...vars, background: 'var(--sovio-background)', color: 'var(--sovio-text)' } as any}>
        <nav style={{ maxWidth: 920, margin: '0 auto', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--sovio-accent)' }}>Sovio</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/" style={{ color: 'var(--sovio-muted)', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Home</a>
            <a href="/pricing" style={{ color: 'var(--sovio-muted)', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Pricing</a>
          </div>
        </nav>
        {children}
        <footer style={{ maxWidth: 920, margin: '0 auto', padding: '48px 32px 32px', borderTop: '1px solid var(--sovio-border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--sovio-muted)', fontSize: 13 }}>Sovio — Plans, without the effort</p>
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update page.tsx with CSS variables**

```tsx
// apps/web/app/page.tsx
export default function Page() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '0 32px' }}>
      <section style={{ padding: '64px 28px', borderRadius: 28, background: 'var(--sovio-surface)', marginBottom: 32 }}>
        <p style={{ color: 'var(--sovio-accent)', fontWeight: 800, marginBottom: 8, fontSize: 14, letterSpacing: 1 }}>SOVIO</p>
        <h1 style={{ fontSize: 52, lineHeight: 1.05, margin: '0 0 16px', color: 'var(--sovio-text)' }}>
          Stop scrolling. Start doing.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--sovio-muted)', maxWidth: 640, margin: '0 0 32px' }}>
          Sovio helps you make real plans faster with smarter suggestions, lighter planning, and less effort.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <a href="#" style={{ display: 'inline-block', background: 'var(--sovio-accent)', color: 'var(--sovio-background)', padding: '14px 28px', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            Download the app
          </a>
          <a href="/pricing" style={{ display: 'inline-block', background: 'var(--sovio-surfaceAlt)', color: 'var(--sovio-text)', padding: '14px 28px', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            See pricing
          </a>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { icon: '✦', title: 'AI-powered plans', body: 'Sovio drafts plans, suggests times, and even writes your opening message. You just say yes.' },
          { icon: '⚡', title: 'Low-effort coordination', body: 'No more group chat ping-pong. Quick matching and smart suggestions get everyone aligned faster.' },
          { icon: '↻', title: 'Replay missed moments', body: 'Skipped something? Sovio resurfaces it later so you never lose a good plan.' },
        ].map((f) => (
          <div key={f.title} style={{ background: 'var(--sovio-surface)', borderRadius: 22, padding: 24 }}>
            <p style={{ fontSize: 28, margin: '0 0 8px' }}>{f.icon}</p>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sovio-text)', margin: '0 0 8px' }}>{f.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--sovio-muted)', margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </section>

      <section style={{ background: 'var(--sovio-accent)', borderRadius: 24, padding: '48px 32px', textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ color: 'var(--sovio-background)', fontSize: 32, fontWeight: 800, margin: '0 0 12px' }}>Do more. Think less.</h2>
        <p style={{ color: 'var(--sovio-surfaceAlt)', fontSize: 16, margin: '0 0 24px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Join the people who stopped scrolling and started doing.
        </p>
        <a href="#" style={{ display: 'inline-block', background: 'var(--sovio-background)', color: 'var(--sovio-accent)', padding: '14px 32px', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
          Get Sovio free
        </a>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Update pricing/page.tsx with CSS variables**

```tsx
// apps/web/app/pricing/page.tsx
export default function PricingPage() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '0 32px' }}>
      <section style={{ textAlign: 'center', padding: '48px 0 32px' }}>
        <h1 style={{ fontSize: 44, margin: '0 0 12px', color: 'var(--sovio-text)' }}>Simple pricing</h1>
        <p style={{ fontSize: 18, color: 'var(--sovio-muted)', margin: 0 }}>
          Start free. Upgrade when you want more.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 48 }}>
        <div style={{ background: 'var(--sovio-surface)', borderRadius: 24, padding: 32 }}>
          <p style={{ color: 'var(--sovio-accent)', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>FREE</p>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--sovio-text)' }}>$0</h2>
          <p style={{ color: 'var(--sovio-muted)', fontSize: 14, margin: '0 0 24px' }}>Forever free</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['AI plan suggestions', 'Basic coordination', '100 AI tokens/month', 'Replay last 7 days', '5 active plans'].map((f) => (
              <li key={f} style={{ fontSize: 14, color: 'var(--sovio-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--sovio-success)', fontWeight: 800 }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <a href="#" style={{ display: 'block', textAlign: 'center', marginTop: 28, background: 'var(--sovio-surfaceAlt)', color: 'var(--sovio-text)', padding: '14px 0', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            Get started
          </a>
        </div>

        <div style={{ background: 'var(--sovio-accent)', borderRadius: 24, padding: 32 }}>
          <p style={{ color: 'var(--sovio-background)', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>SOVIO PRO</p>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--sovio-background)' }}>$6.99<span style={{ fontSize: 16, fontWeight: 600 }}>/mo</span></h2>
          <p style={{ color: 'var(--sovio-surfaceAlt)', fontSize: 14, margin: '0 0 24px' }}>Do more. Think less.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Unlimited AI tokens', 'Priority plan generation', 'AI-drafted replies', 'Full Replay history', 'Unlimited active plans', 'Auto-reply in safe contexts', 'Deeper momentum insights'].map((f) => (
              <li key={f} style={{ fontSize: 14, color: 'var(--sovio-surfaceAlt)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--sovio-background)', fontWeight: 800 }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <a href="#" style={{ display: 'block', textAlign: 'center', marginTop: 28, background: 'var(--sovio-background)', color: 'var(--sovio-accent)', padding: '14px 0', borderRadius: 18, fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>
            Upgrade to Pro
          </a>
        </div>
      </section>
    </main>
  );
}
```

---

## Task 6: Cleanup

**Files:**
- Delete: `docs/updates/APPLY_THESE_UPDATES.md`
- Delete: `docs/updates/FILE_MANIFEST.json`

- [ ] **Step 1: Delete dead update files**

```bash
rm docs/updates/APPLY_THESE_UPDATES.md
rm docs/updates/FILE_MANIFEST.json
rmdir docs/updates
```

- [ ] **Step 2: Update brand system doc**

Replace the accent color reference in `docs/brand/SOVIO_BRAND_SYSTEM.md` — add a `## Colors` section:

```markdown
## Colors
- Accent: Neo Chartreuse #BDFF2E
- Accent Soft: #8ACC00
- Default mode: Dark
```
