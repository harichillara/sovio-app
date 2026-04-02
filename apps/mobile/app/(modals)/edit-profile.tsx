import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TextInput, Button, Avatar, LoadingOverlay } from '@sovio/ui';
import { useAuthStore, useUpdateProfile } from '@sovio/core';

export default function EditProfileModal() {
  const { theme } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  const updateProfile = useUpdateProfile();

  const handleSave = () => {
    updateProfile.mutate(
      { display_name: displayName, bio },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <AppScreen>
      {updateProfile.isPending ? <LoadingOverlay /> : null}
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>Edit Profile</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', gap: 12 }}>
          <Avatar
            uri={profile?.avatar_url}
            name={displayName || 'User'}
            size={80}
          />
          <Pressable>
            <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '600' }}>
              Change photo
            </Text>
          </Pressable>
        </View>

        <TextInput
          label="Display Name"
          placeholder="Your name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        <TextInput
          label="Bio"
          placeholder="Tell people a little about yourself..."
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          autoCapitalize="sentences"
        />

        {updateProfile.error ? (
          <Text style={{ color: theme.danger, fontSize: 14 }}>
            {updateProfile.error.message}
          </Text>
        ) : null}

        <Button label="Save" onPress={handleSave} />
      </ScrollView>
    </AppScreen>
  );
}
