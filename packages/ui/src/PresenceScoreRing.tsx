import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { PresenceScoreRingProps } from './types';

export function PresenceScoreRing({
  score,
  maxScore = 100,
  size = 100,
}: PresenceScoreRingProps) {
  const { theme } = useTheme();

  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(score, 0), maxScore);
  const progress = clamped / maxScore;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.labelContainer, StyleSheet.absoluteFill]}>
        <Text
          style={[
            styles.scoreText,
            { color: theme.text, fontSize: size * 0.28 },
          ]}
        >
          {clamped}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  labelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontWeight: '800',
  },
});
