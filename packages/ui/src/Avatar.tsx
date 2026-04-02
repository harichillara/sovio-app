import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { AvatarProps } from './types';

export function Avatar({ uri, name, size = 48 }: AvatarProps) {
  const { theme } = useTheme();
  const initials = name ? name.charAt(0).toUpperCase() : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.accent,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: size * 0.42, color: theme.background },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
  },
});
