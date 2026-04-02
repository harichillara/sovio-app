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
