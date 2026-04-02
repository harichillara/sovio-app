import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TextInput, Button, LoadingOverlay } from '@sovio/ui';
import { useCreatePlan, useAuthStore, useAIStore } from '@sovio/core';

export default function CreatePlanModal() {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');

  const userId = useAuthStore((s) => s.user?.id);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const setIsGenerating = useAIStore((s) => s.setIsGenerating);
  const createPlan = useCreatePlan();

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      // Placeholder: In production, call an edge function or AI endpoint
      // For now, simulate a suggestion
      await new Promise((r) => setTimeout(r, 1000));
      setAiSuggestion('How about a casual coffee meetup at that new place downtown? Low effort, easy yes.');
      if (!title) setTitle('Coffee Hangout');
      if (!description) setDescription('A casual catch-up at the new cafe. No pressure, just good vibes.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = () => {
    if (!title || !userId) return;
    createPlan.mutate(
      {
        creator_id: userId,
        title,
        description: description || null,
        location_name: location || null,
        scheduled_at: dateTime || null,
        status: 'active',
      },
      {
        onSuccess: () => router.back(),
      }
    );
  };

  return (
    <AppScreen>
      {(createPlan.isPending || isGenerating) ? <LoadingOverlay /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>
              New Plan
            </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>

          <TextInput
            label="Title"
            placeholder="What's the plan?"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />

          <TextInput
            label="Description"
            placeholder="Add some details..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
          />

          <TextInput
            label="Location"
            placeholder="Where?"
            value={location}
            onChangeText={setLocation}
            autoCapitalize="sentences"
          />

          <TextInput
            label="Date & Time"
            placeholder="e.g. Tomorrow 7pm"
            value={dateTime}
            onChangeText={setDateTime}
          />

          {aiSuggestion ? (
            <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 14, padding: 14, gap: 6 }}>
              <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                AI Suggestion
              </Text>
              <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>
                {aiSuggestion}
              </Text>
            </View>
          ) : null}

          {createPlan.error ? (
            <Text style={{ color: theme.danger, fontSize: 14 }}>
              {createPlan.error.message}
            </Text>
          ) : null}

          <Button
            label="Generate with AI"
            onPress={handleGenerateAI}
            variant="secondary"
          />

          <Button
            label="Create Plan"
            onPress={handleCreate}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
