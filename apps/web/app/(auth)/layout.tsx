import React from 'react';
import { cssVars } from '@sovio/tokens/css';
import { darkTheme } from '@sovio/tokens';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const vars = cssVars(darkTheme);

  return (
    <div
      style={{
        ...(vars as React.CSSProperties),
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sovio-background)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
        }}
      >
        {children}
      </div>
    </div>
  );
}
