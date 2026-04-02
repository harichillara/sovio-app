import type { Metadata } from 'next';
import { cssVars } from '@sovio/tokens/css';
import { darkTheme } from '@sovio/tokens';

export const metadata: Metadata = {
  title: 'Sovio — Plans, without the effort',
  description: 'Sovio turns "we should do something" into an actual plan.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const vars = cssVars(darkTheme);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif', ...vars, background: 'var(--sovio-background)', color: 'var(--sovio-text)' } as any}>
        <nav style={{ maxWidth: 920, margin: '0 auto', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--sovio-accent)' }}>Sovio</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/" style={{ color: 'var(--sovio-muted)', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Home</a>
            <a href="/pricing" style={{ color: 'var(--sovio-muted)', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Pricing</a>
          </div>
        </nav>
        {children}
        <footer style={{ maxWidth: 920, margin: '0 auto', padding: '48px 32px 32px', borderTop: '1px solid var(--sovio-border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--sovio-muted)', fontSize: 13 }}>Sovio — Plans, without the effort</p>
        </footer>
      </body>
    </html>
  );
}
