import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import {
  TabScreen,
  SuggestionDeck,
  QuotaMeter,
  PresenceScoreRing,
  UpgradeBanner,
  QueueToast,
} from '@sovio/ui';
import {
  useSuggestions,
  useAcceptSuggestion,
  useDismissSuggestion,
  useEntitlement,
  useIsPro,
  usePresenceScore,
  useTrackEvent,
  useAuthStore,
  useSuggestionsStore,
  eventsService,
} from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

export default function HomeTab() {
  const { theme } = useTheme();

  // Data
  const { data: suggestions = [], isLoading } = useSuggestions();
  const { data: entitlement } = useEntitlement();
  const { data: presenceDay } = usePresenceScore();
  const isPro = useIsPro();
  const userId = useAuthStore((s) => s.user?.id);

  // Mutations
  const acceptMut = useAcceptSuggestion();
  const dismissMut = useDismissSuggestion();
  const trackEvent = useTrackEvent();
  const removeSuggestion = useSuggestionsStore((s) => s.removeSuggestion);

  // Handlers
  const handleAccept = (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    acceptMut.mutate(id, {
      onSuccess: () => {
        removeSuggestion(id);
        if (suggestion?.type === 'plan') {
          router.push('/(modals)/create-plan');
        }
      },
    });
  };

  const handleDismiss = (id: string) => {
    dismissMut.mutate({ suggestionId: id });
    removeSuggestion(id);
  };

  // Quota values
  const quotaUsed = entitlement?.used ?? 0;
  const quotaLimit = entitlement?.limit ?? 50;

  return (
    <TabScreen
      title="Home"
      subtitle="Tonight looks easy"
      headerRight={
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push('/(modals)/presence-score')}>
            <PresenceScoreRing
              score={presenceDay?.score ?? 0}
              size={42}
            />
          </Pressable>
          <QuotaMeter used={quotaUsed} limit={quotaLimit} label="AI" />
        </View>
      }
    >
      {/* Intent Cloud: suggestion deck */}
      <SuggestionDeck
        suggestions={suggestions.map((s) => ({
          id: s.id,
          title: s.title,
          summary: s.summary,
          type: s.type,
        }))}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
      />

      {/* Upgrade banner for free users */}
      {!isPro && (
        <UpgradeBanner
          title="Need more AI help?"
          body="Sovio Pro unlocks more suggestions, faster drafts, and priority plan generation."
          onPress={() => router.push('/(modals)/subscription')}
        />
      )}

      {/* AI generating toast */}
      <QueueToast
        visible={acceptMut.isPending || dismissMut.isPending}
        isPro={isPro}
      />

      {/* FAB for creating a plan */}
      <View style={styles.fabContainer}>
        <Pressable
          onPress={() => router.push('/(modals)/create-plan')}
          style={[styles.fab, { backgroundColor: theme.accent }]}
        >
          <Ionicons name="add" size={28} color={theme.background} />
        </Pressable>
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 0,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
