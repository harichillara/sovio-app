import type { SovioTheme } from './types';

export function cssVars(theme: SovioTheme): Record<string, string> {
  return Object.fromEntries(
    Object.entries(theme).map(([k, v]) => [`--sovio-${k}`, v])
  );
}
