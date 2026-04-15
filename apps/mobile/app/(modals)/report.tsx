import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Button } from '@sovio/ui';
import { TextInput as RNTextInput } from 'react-native';
import { useAuthStore, supabase, eventsService } from '@sovio/core';

const REPORT_REASONS = [
  'Spam or scam',
  'Harassment or bullying',
  'Inappropriate content',
  'Impersonation',
  'Violence or threat',
  'Self-harm',
  'Other',
];

export default function ReportScreen() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const {
    contentType = 'message',
    contentId = '',
    reportedUserId = '',
  } = useLocalSearchParams<{
    contentType?: string;
    contentId?: string;
    reportedUserId?: string;
  }>();

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const reportEventType =
    contentType === 'message'
      ? eventsService.EventTypes.MESSAGE_REPORTED
      : eventsService.EventTypes.USER_REPORTED;

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) {
      Alert.alert('Select a reason', 'Please select a reason for your report.');
      return;
    }
    if (!userId) return;

    setIsSubmitting(true);
    try {
      // Insert report into moderation table
      const { error } = await supabase.from('reports').insert({
        reporter_id: userId,
        content_type: contentType,
        content_id: contentId,
        reported_user_id: reportedUserId || null,
        reason: selectedReason,
        details: details.trim() || null,
        status: 'pending',
      });

      if (error) {
        // Primary insert failed — attempt analytics fallback so the report isn't lost entirely
        await eventsService.trackEvent(
          userId,
          reportEventType,
          {
            content_type: contentType,
            content_id: contentId,
            reported_user_id: reportedUserId || null,
            reason: selectedReason,
            details: details.trim() || null,
            fallback: 'reports_table_missing',
          },
          'moderation',
        ).catch(() => {/* fallback also failed — original error will surface below */});
        throw error;
      }

      await eventsService.trackEvent(
        userId,
        reportEventType,
        {
          content_type: contentType,
          content_id: contentId,
          reported_user_id: reportedUserId || null,
          reason: selectedReason,
        },
        'moderation',
      ).catch((e) => console.warn('analytics:', e));

      setSubmitted(true);
    } catch (err) {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedReason, details, userId, contentType, contentId, reportedUserId, reportEventType]);

  if (submitted) {
    return (
      <AppScreen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Text style={{ fontSize: 48 }}>&#10003;</Text>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
            Report Submitted
          </Text>
          <Text style={{ color: theme.muted, fontSize: 15, textAlign: 'center', maxWidth: 280 }}>
            Thank you for keeping Sovio safe. We will review your report and take action if needed.
          </Text>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </AppScreen>
    );
  }

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
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>Report</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={{ color: theme.muted, fontSize: 14 }}>
          Select a reason for reporting this {contentType}. Your report is confidential.
        </Text>

        {/* Reason selection */}
        <View style={{ gap: 8 }}>
          {REPORT_REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => setSelectedReason(reason)}
              style={{
                backgroundColor:
                  selectedReason === reason ? theme.surfaceAlt : theme.surface,
                borderRadius: 14,
                padding: 14,
                borderWidth: selectedReason === reason ? 1 : 0,
                borderColor: theme.accent,
              }}
            >
              <Text
                style={{
                  color: selectedReason === reason ? theme.accent : theme.text,
                  fontSize: 15,
                  fontWeight: selectedReason === reason ? '700' : '500',
                }}
              >
                {reason}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Additional details */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
            Additional details (optional)
          </Text>
          <RNTextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Describe what happened..."
            placeholderTextColor={theme.muted}
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 14,
              color: theme.text,
              fontSize: 15,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Submit */}
        {isSubmitting ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <Button
            label="Submit Report"
            onPress={handleSubmit}
            disabled={!selectedReason}
          />
        )}
      </ScrollView>
    </AppScreen>
  );
}
