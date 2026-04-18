import React from 'react';
import { Pressable, View, StyleSheet, Text, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import {
  TabScreen,
  SuggestionDeck,
  QuotaMeter,
  PresenceScoreRing,
  UpgradeBanner,
  QueueToast,
  withAlpha,
} from '@sovio/ui';
import {
  useSuggestions,
  useRefreshSuggestions,
  useAcceptSuggestion,
  useDismissSuggestion,
  useEntitlement,
  useIsPro,
  usePresenceScore,
  useSuggestionsStore,
} from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';
import { TopRightActions } from '../../components/TopRightActions';

export default function HomeTab() {
  const { theme } = useTheme();

  // Data
  const { data: suggestions = [] } = useSuggestions();
  const refreshSuggestions = useRefreshSuggestions();
  const { data: entitlement } = useEntitlement();
  const { data: presenceDay } = usePresenceScore();
  const isPro = useIsPro();

  // Mutations
  const acceptMut = useAcceptSuggestion();
  const dismissMut = useDismissSuggestion();
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
      headerRight={<TopRightActions />}
    >
      <View style={styles.statusRow}>
        <Pressable
          onPress={() => refreshSuggestions.mutate()}
          style={[styles.refreshButton, { backgroundColor: theme.surfaceAlt }]}
        >
          <Ionicons
            name={refreshSuggestions.isPending ? 'hourglass-outline' : 'refresh'}
            size={16}
            color={theme.text}
          />
          <Text style={[styles.refreshLabel, { color: theme.text }]}>Refresh</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(modals)/presence-score')}>
          <PresenceScoreRing score={presenceDay?.score ?? 0} size={42} />
        </Pressable>
        <QuotaMeter used={quotaUsed} limit={quotaLimit} label="AI" />
      </View>

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
        visible={acceptMut.isPending || dismissMut.isPending || refreshSuggestions.isPending}
        isPro={isPro}
      />

      {/* FAB for creating a plan */}
      <View style={styles.fabContainer}>
        <Pressable
          onPress={() => router.push('/(modals)/create-plan')}
          style={[
            styles.fab,
            {
              backgroundColor: theme.accent,
              borderColor: theme.border,
              ...(Platform.OS === 'web'
                ? { boxShadow: `0px 12px 28px ${withAlpha(theme.text, 0.18)}` }
                : {
                    shadowColor: theme.text,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 6,
                  }),
            },
          ]}
        >
          <Ionicons name="add" size={28} color={theme.background} />
        </Pressable>
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  refreshButton: {
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  refreshLabel: {
    fontSize: 13,
    fontWeight: '700',
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
