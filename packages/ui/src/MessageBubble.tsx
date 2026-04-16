import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { withAlpha } from './styles';
import type { MessageBubbleProps } from './types';

export function MessageBubble({ content, isMine, isAIDraft, timestamp }: MessageBubbleProps) {
  const { theme } = useTheme();

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? theme.accent : theme.surface,
            borderColor: isAIDraft ? theme.accentSoft : 'transparent',
            borderWidth: isAIDraft ? 1.5 : 0,
            borderStyle: isAIDraft ? 'dashed' : 'solid',
          },
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        {isAIDraft ? (
          <Text style={[styles.aiLabel, { color: theme.accentSoft }]}>AI Draft</Text>
        ) : null}
        <Text
          style={[
            styles.content,
            { color: isMine ? theme.background : theme.text },
          ]}
        >
          {content}
        </Text>
        <Text
          style={[
            styles.time,
            { color: isMine ? withAlpha(theme.background, 0.6) : theme.muted },
          ]}
        >
          {formattedTime}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 4,
    marginVertical: 2,
  },
  rowMine: {
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
  },
  aiLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  content: {
    fontSize: 15,
    lineHeight: 21,
  },
  time: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },
});
