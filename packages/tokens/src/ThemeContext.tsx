import React, { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { lightTheme, darkTheme } from './themes';
import type { SovioTheme } from './types';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: SovioTheme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  const value = useMemo<ThemeContextValue>(() => ({
    theme: mode === 'light' ? lightTheme : darkTheme,
    mode,
    toggleTheme: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
    setMode,
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
