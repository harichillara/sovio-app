import type { ReactNode } from 'react';

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
}

export interface TabScreenProps {
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  children: ReactNode;
}
