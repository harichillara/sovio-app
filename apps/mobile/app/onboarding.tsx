import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppHeader, AppScreen, PillChip, Button, StepProgress, LoadingOverlay } from '@sovio/ui';
import {
  interestOptions,
  socialPreferenceOptions,
  useAuthStore,
  useLocationStore,
  useUpdateProfile,
  supabase,
  notificationsService,
  locationService,
} from '@sovio/core';
import { useMutation } from '@tanstack/react-query';

const steps = ['Welcome', 'Interests', 'Social', 'AI', 'Notifications', 'Location', 'Finish'];

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const userId = useAuthStore((s) => s.user?.id);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setCurrentCoords = useLocationStore((s) => s.setCurrentCoords);
  const setPermissionStatus = useLocationStore((s) => s.setPermissionStatus);
  const updateProfileMutation = useUpdateProfile();

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

  // Mutation: upsert user interests
  const upsertInterests = useMutation({
    mutationFn: async (interests: string[]) => {
      if (!userId) return;
      // Delete existing interests for this user then insert new ones
      await supabase.from('user_interests').delete().eq('user_id', userId);
      if (interests.length > 0) {
        const rows = interests.map((interest) => ({ user_id: userId, interest }));
        const { error } = await supabase.from('user_interests').insert(rows);
        if (error) throw error;
      }
    },
  });

  // Mutation: upsert user preferences
  const upsertPreference = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!userId) return;
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });
      if (error) throw error;
    },
  });

  const handleContinue = useCallback(async () => {
    setSaving(true);
    try {
      switch (step) {
        case 1:
          // Persist interests
          await upsertInterests.mutateAsync(selectedInterests);
          break;
        case 2:
          // Persist social mode preference
          if (selectedPreferences.length > 0) {
            await upsertPreference.mutateAsync({
              key: 'social_mode',
              value: selectedPreferences.join(','),
            });
          }
          break;
        case 3:
          // AI help is enabled via the dedicated button, skip here
          break;
        case 4:
          // Request notification permission
          if (userId) {
            await notificationsService.registerForPushNotifications(userId);
          }
          break;
        case 5:
          // Request location permission and persist a first snapshot so
          // Intent Cloud can work immediately after onboarding.
          {
            const status = await locationService.requestPermission();
            setPermissionStatus(status);
            if (status === 'granted' && userId) {
              const location = await locationService.getCurrentLocation();
              setCurrentCoords({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              await locationService.captureLocationSnapshot(userId, location);
            }
          }
          break;
      }
      setStep((s) => s + 1);
    } catch (e) {
      console.error('Onboarding step error:', e);
      // Still advance even if a step fails
      setStep((s) => s + 1);
    } finally {
      setSaving(false);
    }
  }, [
    step,
    selectedInterests,
    selectedPreferences,
    userId,
    upsertInterests,
    upsertPreference,
    setCurrentCoords,
    setPermissionStatus,
  ]);

  const handleEnableAI = useCallback(async () => {
    setSaving(true);
    try {
      if (userId) {
        await upsertPreference.mutateAsync({ key: 'ai_enabled', value: 'true' });
      }
      setStep((s) => s + 1);
    } finally {
      setSaving(false);
    }
  }, [userId, upsertPreference]);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      // Mark profile as onboarded
      const updated = await updateProfileMutation.mutateAsync({ onboarded: true });
      if (updated) {
        setProfile(updated);
      }
      router.replace('/(tabs)/home');
    } catch (e) {
      console.error('Finish onboarding error:', e);
      // Navigate anyway
      router.replace('/(tabs)/home');
    } finally {
      setSaving(false);
    }
  }, [updateProfileMutation, setProfile]);

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
      {saving ? <LoadingOverlay /> : null}
      <AppHeader title="Sovio" subtitle="Set up your first experience" />
      <StepProgress current={step + 1} total={steps.length} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, flexGrow: 1 }}>
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
            <Button label="Turn on AI help" onPress={handleEnableAI} />
            <Button label="Maybe later" onPress={() => setStep(step + 1)} variant="secondary" />
          </View>
        ) : null}

        {step === 4 ? <Button label="Enable notifications" onPress={handleContinue} /> : null}
        {step === 5 ? <Button label="Enable location" onPress={handleContinue} /> : null}
      </ScrollView>

      <View style={{ marginTop: 20, gap: 10, paddingBottom: 20 }}>
        {step < steps.length - 1 && step !== 3 && step !== 4 && step !== 5 ? (
          <Button label="Continue" onPress={handleContinue} />
        ) : null}
        {step === steps.length - 1 ? (
          <Button label="Open Sovio" onPress={handleFinish} />
        ) : null}
        {step > 0 && step < steps.length - 1 ? (
          <Button label="Back" onPress={() => setStep(step - 1)} variant="secondary" />
        ) : null}
      </View>
    </AppScreen>
  );
}
