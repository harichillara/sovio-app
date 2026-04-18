import { StyleSheet } from 'react-native';
import type { SovioTheme } from '@sovio/tokens';

export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createStyles(theme: SovioTheme) {
  return StyleSheet.create({
    heroCard: { backgroundColor: theme.surface, borderRadius: 28, padding: 22, gap: 12 },
    miniCard: { backgroundColor: theme.surface, borderRadius: 22, padding: 18, gap: 10 },
    invertedCard: { backgroundColor: theme.accent, borderRadius: 24, padding: 18, gap: 8 },

    heading: { color: theme.text, fontSize: 28, fontWeight: '800' },
    title: { color: theme.text, fontSize: 24, fontWeight: '800' },
    subtitle: { color: theme.text, fontSize: 18, fontWeight: '700' },
    body: { color: theme.muted, fontSize: 15, lineHeight: 22 },
    bodySmall: { color: theme.muted, fontSize: 14, lineHeight: 20 },
    label: { color: theme.accent, fontSize: 13, fontWeight: '700' },
    eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1 },

    btnPrimary: { backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 18 },
    btnSecondary: { backgroundColor: theme.surfaceAlt, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 18 },
    btnTextOnAccent: { color: theme.background, fontWeight: '800', textAlign: 'center' as const },
    btnTextOnSurface: { color: theme.text, fontWeight: '800', textAlign: 'center' as const },

    pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
    progressSegment: { height: 6, borderRadius: 999 },
    scrollContent: { gap: 14, paddingBottom: 22 },
    rowBtns: { flexDirection: 'row' as const, gap: 10, marginTop: 6 },
  });
}
