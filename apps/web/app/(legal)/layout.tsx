import React from 'react';
import Link from 'next/link';
import { cssVars } from '@sovio/tokens/css';
import { darkTheme } from '@sovio/tokens';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const vars = cssVars(darkTheme);

  return (
    <div
      style={{
        ...(vars as React.CSSProperties),
        minHeight: '100vh',
        background: 'var(--sovio-background)',
        color: 'var(--sovio-text)',
        padding: '64px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          fontSize: 15,
          lineHeight: 1.7,
        }}
      >
        {/* Counsel-review banner — must render on every legal page */}
        <div
          role="note"
          aria-label="Template review notice"
          style={{
            background: 'var(--sovio-surfaceAlt)',
            border: '1px solid var(--sovio-accent)',
            color: 'var(--sovio-accent)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Template — Review by counsel required before production use
        </div>

        <nav
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 13,
            color: 'var(--sovio-muted)',
          }}
        >
          <Link href="/" style={{ color: 'var(--sovio-accent)', textDecoration: 'none' }}>
            ← Back to home
          </Link>
          <Link href="/terms" style={{ color: 'var(--sovio-muted)', textDecoration: 'none' }}>
            Terms
          </Link>
          <Link href="/privacy" style={{ color: 'var(--sovio-muted)', textDecoration: 'none' }}>
            Privacy
          </Link>
          <Link href="/cookies" style={{ color: 'var(--sovio-muted)', textDecoration: 'none' }}>
            Cookies
          </Link>
        </nav>

        <article
          style={{
            background: 'var(--sovio-surface)',
            borderRadius: 18,
            padding: '36px 32px',
            border: '1px solid var(--sovio-border)',
          }}
        >
          {children}
        </article>

        <p style={{ color: 'var(--sovio-muted)', fontSize: 12, textAlign: 'center' }}>
          This document is a pre-launch MVP template. It is not legal advice. A qualified attorney
          must review and customize it before it goes into production.
        </p>
      </div>
    </div>
  );
}
