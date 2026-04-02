import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { Button } from './Button';
import type { ReportSheetProps } from './types';

const REASONS = [
  { key: 'harassment', label: 'Harassment' },
  { key: 'spam', label: 'Spam' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'other', label: 'Other' },
];

export function ReportSheet({
  visible,
  onClose,
  onSubmit,
}: ReportSheetProps) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit(selected);
      setSelected(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            Report this content
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            Select a reason for your report. We take these seriously.
          </Text>

          <View style={styles.options}>
            {REASONS.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setSelected(r.key)}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      selected === r.key ? theme.accent : theme.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color:
                        selected === r.key ? theme.background : theme.text,
                    },
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <View style={styles.btnWrap}>
              <Button
                label="Submit"
                onPress={handleSubmit}
                variant="primary"
                disabled={!selected}
              />
            </View>
            <View style={styles.btnWrap}>
              <Button label="Cancel" onPress={onClose} variant="secondary" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
  },
  handle: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  options: {
    gap: 10,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnWrap: {
    flex: 1,
  },
});
