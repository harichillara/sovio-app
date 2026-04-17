import React from 'react';
import { Pressable, Text, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { SocialAuthButtonProps } from './types';

export function SocialAuthButton({ provider, onPress }: SocialAuthButtonProps) {
  const { theme } = useTheme();

  // Apple button only renders on iOS
  if (provider === 'apple' && Platform.OS !== 'ios') {
    return null;
  }

  const isGoogle = provider === 'google';
  const label = isGoogle ? 'Continue with Google' : 'Continue with Apple';
  const iconName = isGoogle ? 'logo-google' : 'logo-apple';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          backgroundColor: isGoogle ? theme.surface : theme.text,
          borderColor: isGoogle ? theme.border : theme.text,
          borderWidth: isGoogle ? 1.5 : 0,
        },
      ]}
    >
      <View style={styles.inner}>
        <Ionicons
          name={iconName}
          size={20}
          color={isGoogle ? theme.text : theme.background}
        />
        <Text
          style={[
            styles.label,
            { color: isGoogle ? theme.text : theme.background },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
