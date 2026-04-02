import type { Metadata } from 'next';
import Link from 'next/link';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import { cssVars } from '@sovio/tokens/css';
import { darkTheme } from '@sovio/tokens';
import './globals.css';

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sovio-display',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sovio-mono',
});

export const metadata: Metadata = {
  title: 'Sovio — Plans, without the effort',
  description:
    'Sovio is an anticipatory social system that turns weak intent into real momentum.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const vars = cssVars(darkTheme);

  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${monoFont.variable}`}
        style={{
          ...vars,
          fontFamily: 'var(--font-sovio-display), system-ui, sans-serif',
        } as React.CSSProperties}
      >
        <div className="site-shell">
          <header className="site-header">
            <div className="site-frame site-nav">
              <Link href="/" className="site-brand">
                <span className="site-brand__mark">Sovio</span>
                <span className="site-brand__tag">Plans, without the effort</span>
              </Link>
              <nav className="site-nav__links">
                <Link href="/">Home</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/waitlist">Waitlist</Link>
                <Link href="/login">Login</Link>
              </nav>
            </div>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <div className="site-frame site-footer__inner">
              <span>Sovio is built to shrink friction, not expand screen time.</span>
              <span>Anticipatory social operating system for the next decade.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
