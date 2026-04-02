import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen } from '@sovio/ui';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const FAQ_ITEMS = [
  {
    question: 'How does the AI clone work?',
    answer:
      'Sovio uses AI to learn your preferences and communication style, then drafts messages and plans that sound like you. You always get final approval before anything is sent.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Yes. Your data is encrypted at rest and in transit. We never sell your personal information. You can export or delete your data at any time from Privacy settings.',
  },
  {
    question: 'How do I upgrade to Pro?',
    answer:
      'Go to Settings > Subscription and tap "Upgrade to Pro". Pro gives you unlimited AI calls, full replay history, auto-reply, and more.',
  },
  {
    question: 'What is the Sovio Score?',
    answer:
      'The Sovio Score measures your real-world momentum -- how often you follow through on plans, show up for friends, and engage with life outside your phone.',
  },
  {
    question: 'How do I report someone?',
    answer:
      'Long-press on any message or thread, then tap "Report". You can also report from the settings support page. All reports are reviewed by our team.',
  },
];

export default function SupportScreen() {
  const { theme } = useTheme();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>
            Support & Contact
          </Text>
        </View>

        {/* Contact section */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Contact Us</Text>
          <Pressable
            onPress={() => Linking.openURL('mailto:support@sovio.app')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 6,
            }}
          >
            <Ionicons name="mail-outline" size={20} color={theme.accent} />
            <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '600' }}>
              support@sovio.app
            </Text>
          </Pressable>
        </View>

        {/* FAQ */}
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: theme.accent,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Frequently Asked Questions
          </Text>

          {FAQ_ITEMS.map((item, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <Pressable
                key={idx}
                onPress={() => setExpandedIdx(isExpanded ? null : idx)}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 14,
                  gap: isExpanded ? 10 : 0,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 15,
                      fontWeight: '600',
                      flex: 1,
                      paddingRight: 8,
                    }}
                  >
                    {item.question}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.muted}
                  />
                </View>
                {isExpanded && (
                  <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
                    {item.answer}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Report a problem */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(modals)/report',
              params: { contentType: 'app', contentId: 'general' },
            })
          }
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="bug-outline" size={20} color={theme.danger} />
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
            Report a problem
          </Text>
        </Pressable>

        {/* App version */}
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <Text style={{ color: theme.muted, fontSize: 12 }}>Sovio v{appVersion}</Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}
