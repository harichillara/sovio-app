import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { Button } from './Button';
import type { BlockConfirmModalProps } from './types';

export function BlockConfirmModal({
  visible,
  userName,
  onConfirm,
  onCancel,
}: BlockConfirmModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Block {userName}?
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            They won't be able to see your plans, message you, or find you in
            Momentum. You can unblock them later in settings.
          </Text>
          <View style={styles.actions}>
            <View style={styles.btnWrap}>
              <Button label="Block" onPress={onConfirm} variant="primary" />
            </View>
            <View style={styles.btnWrap}>
              <Button label="Cancel" onPress={onCancel} variant="secondary" />
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 32,
  },
  dialog: {
    borderRadius: 24,
    padding: 24,
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btnWrap: {
    flex: 1,
  },
});
