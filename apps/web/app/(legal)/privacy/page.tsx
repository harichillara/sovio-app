import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy (Template) — Sovio',
  description: 'Template Privacy Policy for Sovio. Pending attorney review.',
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

export default function PrivacyPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--sovio-text)' }}>
        Privacy Policy
      </h1>
      <p style={sub}>
        Effective date: <B name="EFFECTIVE_DATE" /> &nbsp;·&nbsp; Last updated:{' '}
        <B name="LAST_UPDATED_DATE" />
      </p>

      <p>
        This Privacy Policy describes how <B name="COMPANY_LEGAL_NAME" /> (&ldquo;Sovio,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and shares information when you use the
        Sovio application, website, and related services (the &ldquo;Service&rdquo;). Where this
        policy and our Terms of Service conflict, the Terms control for contractual matters and
        this policy controls for data protection matters.
      </p>

      <h2 style={heading}>1. Data We Collect</h2>
      <p>We collect the following categories of data:</p>
      <ul>
        <li>
          <strong>Account data:</strong> email address, display name, and profile photo you upload.
        </li>
        <li>
          <strong>Location data:</strong> approximate or precise location, collected only if you
          enable location features.
        </li>
        <li>
          <strong>Calendar metadata:</strong> event titles, times, and attendee signals when you
          connect a calendar integration. We do not request full calendar bodies unless you opt in
          via <B name="CALENDAR_CONSENT_FLOW" />.
        </li>
        <li>
          <strong>Messages:</strong> messages you send to other users through the Service and
          associated read receipts, reactions, and timestamps.
        </li>
        <li>
          <strong>AI-generated drafts:</strong> drafts and suggestions our AI systems produce on
          your behalf, including the prompts and context used to generate them.
        </li>
        <li>
          <strong>Billing identifiers:</strong> Stripe customer ID, subscription status, and the
          last four digits or brand of your payment card as returned by Stripe. We do not store
          full card numbers.
        </li>
        <li>
          <strong>Device and push data:</strong> device type, operating system, app version, and
          push-notification tokens.
        </li>
        <li>
          <strong>Usage and diagnostic data:</strong> feature interaction events, performance
          metrics, and crash reports used to operate and improve the Service.
        </li>
        <li>
          <strong>Support correspondence:</strong> messages you send when contacting support and
          the context needed to respond.
        </li>
      </ul>
      <p>
        We do not intentionally collect special-category data (such as health, biometric, or
        political-opinion data). If you post such data in user-generated content, you do so at your
        own discretion.
      </p>

      <h2 style={heading}>2. How We Use Your Data</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To personalize suggestions, drafts, and plans tailored to you.</li>
        <li>To operate billing, enforce subscription limits, and detect payment fraud.</li>
        <li>To send transactional communications (account, security, billing, support).</li>
        <li>
          To send product updates or marketing, where permitted by law and subject to your
          preferences. You can opt out at any time via <B name="MARKETING_OPT_OUT_PATH" />.
        </li>
        <li>
          To monitor for abuse, enforce our Terms, and comply with legal obligations (e.g.,
          responding to lawful requests).
        </li>
        <li>
          To train or fine-tune our own models: <B name="MODEL_TRAINING_POLICY" />. We do not share
          your content with third-party AI providers for their own model training.
        </li>
      </ul>

      <h2 style={heading}>3. Legal Basis (If GDPR or UK GDPR Applies to You)</h2>
      <p>
        If you are in the European Economic Area, the United Kingdom, or Switzerland, we rely on
        the following legal bases:
      </p>
      <ul>
        <li>
          <strong>Contract:</strong> to provide the Service you requested.
        </li>
        <li>
          <strong>Legitimate interests:</strong> to secure the Service, prevent fraud, and improve
          our features, balanced against your rights. See <B name="LEGITIMATE_INTERESTS_ASSESSMENT_REFERENCE" />.
        </li>
        <li>
          <strong>Consent:</strong> for optional features such as location, push notifications, and
          marketing email. You may withdraw consent at any time.
        </li>
        <li>
          <strong>Legal obligation:</strong> to comply with applicable laws and lawful requests.
        </li>
      </ul>

      <h2 style={heading}>4. Sharing With Third Parties</h2>
      <p>
        We do not sell personal data in the ordinary sense of the word. We share data with the
        following categories of service providers (subprocessors), under contracts that restrict
        their use of the data:
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={tableHead}>Subprocessor</th>
            <th style={tableHead}>Purpose</th>
            <th style={tableHead}>Data categories</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tableCell}>Supabase</td>
            <td style={tableCell}>Primary database, authentication, and file storage.</td>
            <td style={tableCell}>
              Account data, messages, AI drafts, calendar metadata, uploaded images.
            </td>
          </tr>
          <tr>
            <td style={tableCell}>Google (Gemini API)</td>
            <td style={tableCell}>AI inference for drafts, suggestions, and summaries.</td>
            <td style={tableCell}>Prompts, AI context snippets, and generated outputs.</td>
          </tr>
          <tr>
            <td style={tableCell}>Stripe</td>
            <td style={tableCell}>Payment processing and subscription billing.</td>
            <td style={tableCell}>Email, billing identifiers, payment-method metadata.</td>
          </tr>
          <tr>
            <td style={tableCell}>Sentry</td>
            <td style={tableCell}>Error monitoring and performance tracing.</td>
            <td style={tableCell}>Device diagnostics, crash reports, IP address.</td>
          </tr>
          <tr>
            <td style={tableCell}>Expo</td>
            <td style={tableCell}>Mobile app delivery and push-notification relay.</td>
            <td style={tableCell}>Push tokens, device identifiers.</td>
          </tr>
          <tr>
            <td style={tableCell}>Apple</td>
            <td style={tableCell}>iOS app distribution and APNs push delivery.</td>
            <td style={tableCell}>App Store account identifiers, push tokens.</td>
          </tr>
          <tr>
            <td style={tableCell}>Google (Play + FCM)</td>
            <td style={tableCell}>Android app distribution and FCM push delivery.</td>
            <td style={tableCell}>Play account identifiers, push tokens.</td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: 16 }}>
        We also disclose data when required by law (for example, response to a valid subpoena,
        court order, or government request), to enforce our Terms, or to protect the rights,
        safety, or property of Sovio, our users, or the public. In the event of a merger,
        acquisition, or asset sale, data may be transferred to the successor subject to this
        policy. We will notify affected users before any such transfer takes effect.
      </p>

      <h2 style={heading}>5. Retention</h2>
      <p>
        We retain data only as long as needed for the purposes described above. Typical retention
        windows:
      </p>
      <ul>
        <li>
          Account data: while your account is active, plus <B name="ACCOUNT_GRACE_DAYS" /> days
          after deletion request for recovery.
        </li>
        <li>
          Messages and AI drafts: until you delete them, close your account, or the retention
          schedule at <B name="RETENTION_POLICY_REFERENCE" /> elapses.
        </li>
        <li>
          Billing records: as required by tax and accounting law (typically{' '}
          <B name="BILLING_RETENTION_YEARS" /> years).
        </li>
        <li>Sentry diagnostics and logs: retained according to vendor defaults, typically 30–90 days.</li>
      </ul>

      <h2 style={heading}>6. Your Rights</h2>
      <p>
        Depending on where you live, you may have the following rights regarding your personal
        data:
      </p>
      <ul>
        <li>
          <strong>Access and portability:</strong> request a copy of the personal data we hold
          about you in a machine-readable format.
        </li>
        <li>
          <strong>Rectification:</strong> correct inaccurate or incomplete data.
        </li>
        <li>
          <strong>Deletion:</strong> request deletion of your account and associated data, subject
          to legal retention obligations.
        </li>
        <li>
          <strong>Restriction and objection:</strong> restrict or object to certain processing,
          including marketing and profiling.
        </li>
        <li>
          <strong>Withdraw consent:</strong> where we process on consent, withdraw it at any time
          without affecting past processing.
        </li>
        <li>
          <strong>Complaint:</strong> lodge a complaint with your local supervisory authority; in
          the EU, you can find yours via <B name="EU_SUPERVISORY_AUTHORITY_LINK" />.
        </li>
      </ul>
      <p>
        To exercise these rights, submit a request through our DSAR form at{' '}
        <Link href="/dsar" style={{ color: 'var(--sovio-accent)' }}>
          /dsar
        </Link>{' '}
        or email <B name="PRIVACY_CONTACT_EMAIL" />. We will respond within <B name="DSAR_RESPONSE_DAYS" />{' '}
        days. If you are a California resident, the California Consumer Privacy Act (CCPA) may
        apply and grant additional rights, including the right to know what categories of personal
        information we sell or share (we do not sell personal information in the traditional sense;
        see <B name="CCPA_DO_NOT_SELL_DISCLOSURE" /> for our disclosure).
      </p>

      <h2 style={heading}>7. International Data Transfers</h2>
      <p>
        Our primary infrastructure is hosted in Supabase&rsquo;s US-East region. If you access the
        Service from outside the United States, your data will be transferred to and processed in
        the United States. For transfers from the EEA, UK, or Switzerland, we rely on appropriate
        safeguards such as Standard Contractual Clauses. See <B name="TRANSFER_MECHANISM_DETAILS" />{' '}
        for specifics.
      </p>

      <h2 style={heading}>8. Security</h2>
      <p>
        We use industry-standard safeguards including encryption in transit (TLS), encryption at
        rest for supported storage, least-privilege access controls, and row-level security in our
        primary database. No system is perfectly secure. If we become aware of a breach affecting
        your personal data, we will notify you in accordance with applicable law. Contact{' '}
        <B name="SECURITY_CONTACT_EMAIL" /> to report a suspected vulnerability.
      </p>

      <h2 style={heading}>9. Children&rsquo;s Privacy</h2>
      <p>
        The Service is not directed to children under <B name="CHILDREN_AGE_THRESHOLD_13_OR_16" />{' '}
        years old, and we do not knowingly collect personal data from children under that age. If
        you believe we have inadvertently collected such data, contact us and we will delete it
        promptly. Parents or guardians with concerns may email <B name="PRIVACY_CONTACT_EMAIL" />.
      </p>

      <h2 style={heading}>10. Cookies and Similar Technologies</h2>
      <p>
        We use cookies and similar technologies to operate the web application, remember your
        session, and improve the Service. For details, see our{' '}
        <Link href="/cookies" style={{ color: 'var(--sovio-accent)' }}>
          Cookie Notice
        </Link>
        .
      </p>

      <h2 style={heading}>11. Automated Decision-Making and AI Profiling</h2>
      <p>
        We use automated systems (including large language models) to generate suggestions and
        drafts. These do not produce legal or similarly significant effects. If we ever introduce
        automated decision-making that meaningfully affects your rights, we will update this
        section and provide the safeguards required by <B name="AUTOMATED_DECISION_LEGAL_FRAMEWORK" />.
      </p>

      <h2 style={heading}>12. Jurisdiction-Specific Disclosures</h2>
      <p>
        <strong>California residents (CCPA / CPRA):</strong> <B name="CCPA_CATEGORIES_COLLECTED" />,{' '}
        <B name="CCPA_SOURCES" />, <B name="CCPA_PURPOSES" />, <B name="CCPA_SHARING_DISCLOSURE" />.
        You have the right to know, delete, correct, and limit the use of sensitive personal
        information. We do not knowingly sell personal information. We do not use or disclose
        sensitive personal information for purposes that require a right to limit.
      </p>
      <p>
        <strong>EEA / UK residents (GDPR / UK GDPR):</strong> legal bases are set out in Section 3.
        Our Data Protection Officer, if one is appointed, can be reached at{' '}
        <B name="DPO_CONTACT_EMAIL" />. EU representative: <B name="EU_REPRESENTATIVE_DETAILS" />.
        UK representative: <B name="UK_REPRESENTATIVE_DETAILS" />.
      </p>
      <p>
        <strong>Other jurisdictions:</strong> <B name="OTHER_JURISDICTION_ADDENDA" />.
      </p>

      <h2 style={heading}>13. Changes to This Policy</h2>
      <p>
        We may update this policy. If we make material changes, we will notify you via{' '}
        <B name="PRIVACY_NOTICE_METHOD" /> at least <B name="PRIVACY_NOTICE_PERIOD_DAYS" /> days
        before the change takes effect, unless a shorter period is required by law.
      </p>

      <h2 style={heading}>14. Contact</h2>
      <p>
        Privacy questions or requests: <B name="PRIVACY_CONTACT_EMAIL" />. Mailing address:{' '}
        <B name="COMPANY_LEGAL_NAME" />, <B name="COMPANY_MAILING_ADDRESS" />.
      </p>
    </div>
  );
}
