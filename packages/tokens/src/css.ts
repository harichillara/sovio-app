import type { SovioTheme } from './types';

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const value = parseInt(full, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function cssVars(theme: SovioTheme): Record<string, string> {
  const accent = hexToRgb(theme.accent);
  const accentSoft = hexToRgb(theme.accentSoft);
  const border = hexToRgb(theme.border);
  const background = hexToRgb(theme.background);

  return {
    ...Object.fromEntries(
      Object.entries(theme).map(([k, v]) => [`--sovio-${k}`, v]),
    ),
    '--sovio-glow': `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.26)`,
    '--sovio-glow-soft': `rgba(${accentSoft.r}, ${accentSoft.g}, ${accentSoft.b}, 0.14)`,
    '--sovio-grid': `rgba(${border.r}, ${border.g}, ${border.b}, 0.18)`,
    '--sovio-overlay': `rgba(${background.r}, ${background.g}, ${background.b}, 0.76)`,
    '--sovio-shadow': `rgba(${background.r}, ${background.g}, ${background.b}, 0.58)`,
  };
}
