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
