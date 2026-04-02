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

// --- New component prop interfaces ---

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
