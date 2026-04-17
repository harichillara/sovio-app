import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Cookie Notice (Template) — Sovio',
  description: 'Template Cookie Notice for Sovio. Pending attorney review.',
};

const heading: React.CSSProperties = {
  color: 'var(--sovio-text)',
  fontSize: 18,
  fontWeight: 800,
  marginTop: 28,
  marginBottom: 10,
};

const sub: React.CSSProperties = {
  color: 'var(--sovio-muted)',
  fontSize: 13,
  marginTop: 0,
  marginBottom: 16,
};

const bracket: React.CSSProperties = {
  background: 'var(--sovio-surfaceAlt)',
  border: '1px dashed var(--sovio-accent)',
  color: 'var(--sovio-accent)',
  padding: '1px 6px',
  borderRadius: 6,
  fontFamily: 'var(--font-sovio-mono), monospace',
  fontSize: 12,
};

function B({ name }: { name: string }) {
  return <span style={bracket}>[{name}]</span>;
}

const tableCell: React.CSSProperties = {
  border: '1px solid var(--sovio-border)',
  padding: '8px 12px',
  fontSize: 13,
  verticalAlign: 'top',
};

const tableHead: React.CSSProperties = {
  ...tableCell,
  background: 'var(--sovio-surfaceAlt)',
  fontWeight: 700,
  color: 'var(--sovio-text)',
};

export default function CookiesPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--sovio-text)' }}>
        Cookie Notice
      </h1>
      <p style={sub}>
        Effective date: <B name="EFFECTIVE_DATE" /> &nbsp;·&nbsp; Last updated:{' '}
        <B name="LAST_UPDATED_DATE" />
      </p>

      <p>
        This Cookie Notice explains how <B name="COMPANY_LEGAL_NAME" /> uses cookies and similar
        technologies on the Sovio website. Read together with our{' '}
        <Link href="/privacy" style={{ color: 'var(--sovio-accent)' }}>
          Privacy Policy
        </Link>
        .
      </p>

      <h2 style={heading}>1. What Cookies Are</h2>
      <p>
        Cookies are small text files stored in your browser. &ldquo;Similar technologies&rdquo;
        include local storage, session storage, and SDK identifiers. We use them to keep you
        logged in, remember preferences, and understand how the site is used.
      </p>

      <h2 style={heading}>2. Categories We Use</h2>
      <h3 style={{ ...heading, fontSize: 15 }}>Strictly necessary (essential)</h3>
      <p>
        These cookies are required for the site to function. Disabling them will break core
        features such as signing in. We rely on Supabase authentication cookies to maintain your
        logged-in session.
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={tableHead}>Cookie / key</th>
            <th style={tableHead}>Purpose</th>
            <th style={tableHead}>Lifetime</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tableCell}>
              <code>sb-*-auth-token</code> (Supabase)
            </td>
            <td style={tableCell}>
              Keeps you signed in and associates requests with your account.
            </td>
            <td style={tableCell}>
              Session or up to <B name="SUPABASE_SESSION_LIFETIME" />
            </td>
          </tr>
          <tr>
            <td style={tableCell}>
              <code>sovio-consent</code>
            </td>
            <td style={tableCell}>Remembers your cookie preferences.</td>
            <td style={tableCell}>
              <B name="CONSENT_COOKIE_LIFETIME" />
            </td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ ...heading, fontSize: 15 }}>Analytics</h3>
      <p>
        We do not currently run product-analytics cookies on the marketing website. If we add them
        in the future (for example, <B name="FUTURE_ANALYTICS_VENDOR" />), we will update this
        notice and, where required, obtain your consent before loading them.
      </p>

      <h3 style={{ ...heading, fontSize: 15 }}>Third-party cookies</h3>
      <p>
        Some pages load third-party scripts that may set their own cookies:
      </p>
      <ul>
        <li>
          <strong>Stripe:</strong> on billing and checkout pages, Stripe sets cookies to support
          fraud prevention and payment processing. See{' '}
          <B name="STRIPE_COOKIE_POLICY_URL" />.
        </li>
        <li>
          <strong>Sentry:</strong> Sentry may use cookies or local storage to correlate errors with
          sessions for debugging. See <B name="SENTRY_COOKIE_POLICY_URL" />.
        </li>
      </ul>
      <p>
        We do not control third-party cookies. Please review those providers&rsquo; policies for
        details.
      </p>

      <h2 style={heading}>3. Managing Your Preferences</h2>
      <p>
        You can control cookies through your browser settings, block all cookies, or delete cookies
        already stored. Note that blocking strictly necessary cookies will prevent the Service from
        working properly.
      </p>
      <p>
        <B name="COOKIE_CONTROLS_INSTRUCTION" />
      </p>
      <p>
        If you are in a jurisdiction with consent requirements (such as the EEA or UK), you will be
        asked for consent before any non-essential cookies are loaded. You can change your choice
        at any time via <B name="CONSENT_BANNER_RESET_LINK" />.
      </p>

      <h2 style={heading}>4. Do Not Track</h2>
      <p>
        Some browsers transmit a &ldquo;Do Not Track&rdquo; signal. There is no industry consensus
        on how to interpret it. Our current behavior: <B name="DNT_POLICY_STATEMENT" />.
      </p>

      <h2 style={heading}>5. Changes to This Notice</h2>
      <p>
        We may update this notice from time to time. If we introduce new cookie categories or
        vendors, we will update the table above and, where required, request fresh consent.
      </p>

      <h2 style={heading}>6. Contact</h2>
      <p>
        Questions: <B name="PRIVACY_CONTACT_EMAIL" />.
      </p>
    </div>
  );
}
