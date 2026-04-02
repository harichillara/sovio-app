import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import {
  TabScreen,
  HeroActionCard,
  MiniActionCard,
  TokenMeter,
  UpgradeBanner,
  EmptyState,
} from '@sovio/ui';
import {
  useSuggestedPlans,
  useAITokens,
  useAuthStore,
  useAIStore,
  useMessagesStore,
} from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

export default function HomeTab() {
  const { theme } = useTheme();
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');
  const tokensUsed = useAIStore((s) => s.tokensUsed);
  const tokensLimit = useAIStore((s) => s.tokensLimit);
  const unreadCount = useMessagesStore((s) => s.unreadCount);

  const { data: suggested, isLoading } = useSuggestedPlans();
  useAITokens(); // triggers store update

  const firstPlan = suggested?.[0];

  return (
    <TabScreen
      title="Home"
      subtitle="Tonight looks easy"
      headerRight={
        <TokenMeter
          used={tokensUsed}
          total={tokensLimit === Infinity ? 1000 : tokensLimit}
        />
      }
    >
      {firstPlan ? (
        <HeroActionCard
          eyebrow="READY NOW"
          title={firstPlan.title}
          body={firstPlan.description ?? 'A plan is ready for you. Low effort. Easy yes.'}
          primaryLabel="Do it"
          secondaryLabel="Not now"
          onPrimary={() => router.push({ pathname: '/(modals)/plan-detail', params: { planId: firstPlan.id } })}
        />
      ) : (
        <EmptyState
          icon="sparkles-outline"
          title="No suggestions yet"
          body="Create your first plan or check back later for AI-powered suggestions."
          actionLabel="Create a plan"
          onAction={() => router.push('/(modals)/create-plan')}
        />
      )}

      <MiniActionCard
        title="Messages"
        body={unreadCount > 0 ? `${unreadCount} unread conversation${unreadCount > 1 ? 's' : ''}` : 'No new messages'}
        label="Open messages"
        onPress={() => router.push('/(tabs)/messages')}
      />

      <MiniActionCard
        title="Try a nearby spot"
        body="A simple option close to you might be open tonight."
        label="See option"
        onPress={() => router.push('/(tabs)/momentum')}
      />

      {tier === 'free' ? (
        <UpgradeBanner
          title="Need more AI help?"
          body="Sovio Pro unlocks more suggestions, faster drafts, and priority plan generation."
          onPress={() => router.push('/(modals)/subscription')}
        />
      ) : null}

      {/* FAB for creating a plan */}
      <View style={{ position: 'absolute', bottom: 20, right: 0 }}>
        <Pressable
          onPress={() => router.push('/(modals)/create-plan')}
          style={{
            backgroundColor: theme.accent,
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
          }}
        >
          <Ionicons name="add" size={28} color={theme.background} />
        </Pressable>
      </View>
    </TabScreen>
  );
}
