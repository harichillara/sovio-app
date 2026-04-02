import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SuggestionCard } from './SuggestionCard';
import { EmptyState } from './EmptyState';
import type { SuggestionDeckProps } from './types';

export function SuggestionDeck({
  suggestions,
  onAccept,
  onDismiss,
}: SuggestionDeckProps) {
  if (suggestions.length === 0) {
    return (
      <EmptyState
        icon="sparkles-outline"
        title="No suggestions right now"
        body="Check back later for AI-powered ideas based on your interests."
      />
    );
  }

  return (
    <View style={styles.deck}>
      {suggestions.slice(0, 3).map((s) => (
        <SuggestionCard
          key={s.id}
          title={s.title}
          summary={s.summary}
          type={s.type}
          onAccept={() => onAccept(s.id)}
          onDismiss={() => onDismiss(s.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    gap: 12,
  },
});
