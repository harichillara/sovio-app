import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
  const innerSize = size - strokeWidth * 2;
  const progressDegrees = Math.max(0, Math.min(360, Math.round(progress * 360)));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {Platform.OS === 'web' ? (
        <View
          style={[
            styles.webRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: size / 2,
                backgroundImage: `conic-gradient(${theme.accent} 0deg ${progressDegrees}deg, ${theme.border} ${progressDegrees}deg 360deg)`,
              } as any,
            ]}
          />
          <View
            style={[
              styles.webRingCenter,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
                backgroundColor: theme.background,
              },
            ]}
          />
        </View>
      ) : (
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
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
      )}
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
  webRing: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  webRingCenter: {
    zIndex: 1,
  },
  labelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  scoreText: {
    fontWeight: '800',
  },
});
