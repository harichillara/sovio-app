import type { ReactNode } from 'react';
import type { KeyboardTypeOptions } from 'react-native';

export interface AppScreenProps {
  children: ReactNode;
}

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export interface HeroActionCardProps {
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel?: string;
  eyebrow?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export interface MiniActionCardProps {
  title: string;
  body: string;
  label: string;
  onPress?: () => void;
}

export interface PillChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export interface UpgradeBannerProps {
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
}

export interface TokenMeterProps {
  used: number;
  total: number;
}

export interface StepProgressProps {
  current: number;
  total: number;
}

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export interface TabScreenProps {
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

// --- Existing component prop interfaces ---

export interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: KeyboardTypeOptions;
}

export interface SocialAuthButtonProps {
  provider: 'google' | 'apple';
  onPress: () => void;
}

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

export interface EmptyStateProps {
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface MessageBubbleProps {
  content: string;
  isMine: boolean;
  isAIDraft: boolean;
  timestamp: string;
}

// --- Sprint 2: New component prop interfaces ---

export interface SuggestionCardProps {
  title: string;
  summary: string;
  type: 'plan' | 'place' | 'group';
  onAccept: () => void;
  onDismiss: () => void;
}

export interface SuggestionDeckProps {
  suggestions: {
    id: string;
    title: string;
    summary: string;
    type: 'plan' | 'place' | 'group';
  }[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export interface PresenceScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
}

export interface AvailableToggleProps {
  isAvailable: boolean;
  onToggle: (next: boolean) => void;
  category?: string;
  expiresAt?: string | null;
}

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  targetType: 'message' | 'plan' | 'profile' | 'suggestion';
  targetId: string;
}

export interface BlockConfirmModalProps {
  visible: boolean;
  userName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface QueueToastProps {
  visible: boolean;
  message?: string;
  isPro?: boolean;
}

export interface InsightCardProps {
  insight: string;
  experiment?: string;
  weekOf: string;
}

export interface QuotaMeterProps {
  used: number;
  limit: number;
  label?: string;
}

export interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}
