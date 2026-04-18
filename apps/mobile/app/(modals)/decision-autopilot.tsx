import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Button, PillChip, EmptyState } from '@sovio/ui';
import { TextInput as RNTextInput } from 'react-native';
import {
  useAuthStore,
  useAutopilotRules,
  useSetRule,
  useProposals,
  useApproveProposal,
  useRejectProposal,
  aiService,
} from '@sovio/core';
import type { AIProposal } from '@sovio/core';

const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Night'];
const GROUP_OPTIONS = ['Solo', '2-3', '4-6', 'Any'];

export default function DecisionAutopilotScreen() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: rules } = useAutopilotRules();
  const setRuleMutation = useSetRule();
  const { data: proposals, isLoading: proposalsLoading } = useProposals();
  const approveMutation = useApproveProposal();
  const rejectMutation = useRejectProposal();

  // Local state for rules
  const [budget, setBudget] = useState('');
  const [maxTravel, setMaxTravel] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  // Populate from fetched rules
  useEffect(() => {
    if (!rules) return;
    for (const rule of rules) {
      switch (rule.key) {
        case 'autopilot_budget':
          setBudget(rule.value);
          break;
        case 'autopilot_max_travel':
          setMaxTravel(rule.value);
          break;
        case 'autopilot_preferred_times':
          try {
            setSelectedTimes(JSON.parse(rule.value));
          } catch (err) {
            console.warn('[DecisionAutopilot] Failed to parse preferred_times rule — using default. Value:', rule.value, err);
          }
          break;
        case 'autopilot_group_size':
          try {
            setSelectedGroup(JSON.parse(rule.value));
          } catch (err) {
            console.warn('[DecisionAutopilot] Failed to parse group_size rule — using default. Value:', rule.value, err);
          }
          break;
      }
    }
  }, [rules]);

  const saveRule = useCallback(
    (key: string, value: string) => {
      setRuleMutation.mutate({ ruleKey: key, ruleValue: value });
    },
    [setRuleMutation],
  );

  const toggleTime = (time: string) => {
    const next = selectedTimes.includes(time)
      ? selectedTimes.filter((t) => t !== time)
      : [...selectedTimes, time];
    setSelectedTimes(next);
    saveRule('autopilot_preferred_times', JSON.stringify(next));
  };

  const toggleGroup = (group: string) => {
    const next = selectedGroup.includes(group)
      ? selectedGroup.filter((g) => g !== group)
      : [...selectedGroup, group];
    setSelectedGroup(next);
    saveRule('autopilot_group_size', JSON.stringify(next));
  };

  const handleGenerateProposal = async () => {
    if (!userId) return;
    setGenerating(true);
    try {
      await aiService.invokeAIGenerate({
        op: 'decision_proposal',
        userId,
        constraints: {
          budget,
          maxTravel,
          preferredTimes: selectedTimes,
          groupSize: selectedGroup,
        },
      });
      Alert.alert('Generating', 'A new proposal is being generated. Check back shortly!');
    } catch (err) {
      if (err instanceof aiService.QuotaExceededError) {
        Alert.alert('Daily AI limit reached', 'Upgrade to Pro for more AI proposals.');
      } else {
        Alert.alert('Error', 'Could not generate proposal.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const proposalList = proposals ?? [];

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
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>
            Decision Autopilot
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>

        {/* YOUR RULES */}
        <View style={{ gap: 14 }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 14, gap: 6 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>
              You stay in control
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>
              Autopilot drafts decisions from your rules, but every proposal still waits for your approval before anything meaningful changes.
            </Text>
          </View>

          <Text
            style={{
              color: theme.accent,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Your Rules
          </Text>

          {/* Budget */}
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 14, gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
              Budget per outing
            </Text>
            <RNTextInput
              value={budget}
              onChangeText={(v) => {
                setBudget(v);
              }}
              onBlur={() => saveRule('autopilot_budget', budget)}
              placeholder="e.g. 50"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={{
                backgroundColor: theme.surfaceAlt,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: theme.text,
                fontSize: 15,
              }}
            />
          </View>

          {/* Max travel time */}
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 14, gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
              Max travel time (minutes)
            </Text>
            <RNTextInput
              value={maxTravel}
              onChangeText={(v) => {
                setMaxTravel(v);
              }}
              onBlur={() => saveRule('autopilot_max_travel', maxTravel)}
              placeholder="e.g. 30"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={{
                backgroundColor: theme.surfaceAlt,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: theme.text,
                fontSize: 15,
              }}
            />
          </View>

          {/* Preferred times */}
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 14, gap: 10 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
              Preferred times
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TIME_OPTIONS.map((time) => (
                <PillChip
                  key={time}
                  label={time}
                  selected={selectedTimes.includes(time)}
                  onPress={() => toggleTime(time)}
                />
              ))}
            </View>
          </View>

          {/* Group size */}
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 14, gap: 10 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
              Preferred group size
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GROUP_OPTIONS.map((group) => (
                <PillChip
                  key={group}
                  label={group}
                  selected={selectedGroup.includes(group)}
                  onPress={() => toggleGroup(group)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* AI PROPOSALS */}
        <View style={{ gap: 14 }}>
          <Text
            style={{
              color: theme.accent,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            AI Proposals
          </Text>

          {proposalsLoading && (
            <ActivityIndicator color={theme.accent} style={{ paddingVertical: 16 }} />
          )}

          {!proposalsLoading && proposalList.length === 0 && (
            <EmptyState
              icon="bulb-outline"
              title="No proposals yet"
              body="Set your rules above, then tap Generate to get AI-powered plan proposals."
            />
          )}

          {proposalList.map((proposal: AIProposal) => {
            const result = proposal.result ?? {};
            return (
              <View
                key={proposal.id}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 14,
                  gap: 10,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
                  {result.title ?? 'Proposal'}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 14 }}>
                  {result.summary ?? 'No summary available'}
                </Text>

                {result.assumptions && result.assumptions.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700' }}>
                      Assumptions:
                    </Text>
                    {result.assumptions.map((a: string, i: number) => (
                      <Text key={i} style={{ color: theme.muted, fontSize: 12 }}>
                        {'\u2022'} {a}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Pressable
                    onPress={() => approveMutation.mutate({ jobId: proposal.id })}
                    style={{
                      flex: 1,
                      backgroundColor: theme.accent,
                      borderRadius: 12,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.background, fontWeight: '800', fontSize: 14 }}>
                      Approve
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => rejectMutation.mutate({ jobId: proposal.id })}
                    style={{
                      flex: 1,
                      backgroundColor: theme.surfaceAlt,
                      borderRadius: 12,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.muted, fontWeight: '800', fontSize: 14 }}>
                      Not this one
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* Generate new proposal */}
        {generating ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <Button label="Generate new proposal" onPress={handleGenerateProposal} />
        )}
      </ScrollView>
    </AppScreen>
  );
}
