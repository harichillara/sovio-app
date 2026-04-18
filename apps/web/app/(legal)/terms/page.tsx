import React from 'react';

export const metadata = {
  title: 'Terms of Service (Template) — Sovio',
  description: 'Template Terms of Service for Sovio. Pending attorney review.',
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

export default function TermsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--sovio-text)' }}>
        Terms of Service
      </h1>
      <p style={sub}>
        Effective date: <B name="EFFECTIVE_DATE" /> &nbsp;·&nbsp; Last updated:{' '}
        <B name="LAST_UPDATED_DATE" />
      </p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Sovio
        application, website, and related services (collectively, the &ldquo;Service&rdquo;),
        operated by <B name="COMPANY_LEGAL_NAME" />, a company organized under the laws of{' '}
        <B name="STATE_OF_INCORPORATION" /> (&ldquo;Sovio,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
        or &ldquo;our&rdquo;). By using the Service, you agree to these Terms.
      </p>

      <h2 style={heading}>1. Acceptance of Terms</h2>
      <p>
        By creating an account, installing our mobile app, or otherwise using the Service, you
        confirm that you are at least <B name="MINIMUM_AGE" /> years old and that you have the legal
        capacity to enter into a binding agreement in your jurisdiction. If you do not agree to
        these Terms, do not use the Service.
      </p>
      <p>
        We may update these Terms from time to time. If we make material changes, we will provide
        notice via <B name="NOTICE_METHOD" /> at least <B name="NOTICE_PERIOD_DAYS" /> days in
        advance. Continued use after changes take effect constitutes acceptance.
      </p>

      <h2 style={heading}>2. Your Account</h2>
      <p>
        To use most features you must create an account. You agree to provide accurate information,
        keep your credentials confidential, and notify us immediately at{' '}
        <B name="SECURITY_CONTACT_EMAIL" /> if you suspect unauthorized access. You are responsible
        for all activity that occurs under your account.
      </p>
      <p>
        You may close your account at any time by following the process described in{' '}
        <B name="ACCOUNT_CLOSURE_SECTION_REFERENCE" />. Closing your account does not immediately
        erase all data; see our Privacy Policy and the data retention section below.
      </p>

      <h2 style={heading}>3. Acceptable Use</h2>
      <p>You agree not to, and not to permit others to:</p>
      <ul>
        <li>Use the Service in any way that violates applicable law or the rights of others.</li>
        <li>
          Harass, abuse, threaten, or defame any person, or use the Service to send spam, phishing
          attempts, or unsolicited commercial communications.
        </li>
        <li>
          Attempt to probe, scan, reverse-engineer, or compromise the security of the Service, our
          infrastructure, or other users&rsquo; accounts.
        </li>
        <li>
          Use automated tools to scrape, harvest, or otherwise extract data from the Service without
          our written consent, except as permitted by a published API.
        </li>
        <li>
          Upload or transmit malware, or content that infringes intellectual property rights, is
          unlawful, or violates the privacy or publicity rights of others.
        </li>
        <li>
          Use the Service to build a competing product or to train machine-learning models without
          a separate written agreement.
        </li>
        <li>
          Engage in any conduct prohibited by <B name="JURISDICTION_SPECIFIC_RESTRICTIONS" />.
        </li>
      </ul>
      <p>
        We may suspend or terminate accounts that, in our reasonable judgment, violate this
        section. Egregious or repeated violations may result in permanent bans.
      </p>

      <h2 style={heading}>4. Your Content</h2>
      <p>
        You retain ownership of content you submit, upload, or create through the Service
        (&ldquo;User Content&rdquo;). By submitting User Content, you grant Sovio a worldwide,
        non-exclusive, royalty-free license to host, store, reproduce, and process your content for
        the sole purpose of operating, improving, and supporting the Service. This license ends when
        you delete the content or close your account, except where we must retain copies to comply
        with law or resolve disputes. See <B name="LICENSE_SCOPE_CLARIFICATION" /> for additional
        limitations.
      </p>
      <p>
        You are solely responsible for your User Content and for any consequences of sharing it. You
        represent that you have all rights necessary to grant the license above.
      </p>

      <h2 style={heading}>5. AI-Generated Content Disclosure</h2>
      <p>
        The Service uses large language models and other machine-learning systems to generate
        suggestions, message drafts, plans, and summaries (&ldquo;AI Output&rdquo;). AI Output is
        generated probabilistically. It may be inaccurate, incomplete, biased, or inappropriate for
        your situation. You are responsible for reviewing AI Output before sending, acting on, or
        otherwise relying on it.
      </p>
      <p>
        We route prompts and context to third-party AI providers listed in our Privacy Policy. We do
        not guarantee that AI Output is unique, original, or non-infringing. Do not use the Service
        to generate content that is illegal, harmful, or prohibited under <B name="AI_USE_POLICY_REFERENCE" />.
      </p>
      <p>
        You may not use AI Output in a way that misrepresents its origin in contexts where that
        misrepresentation would be misleading or unlawful (for example, <B name="AI_DISCLOSURE_CONTEXTS" />).
      </p>

      <h2 style={heading}>6. Subscriptions, Payments, and Refunds</h2>
      <p>
        Some features require a paid subscription. Pricing, billing cycle, and included usage
        limits are described at <B name="PRICING_PAGE_URL" />. By purchasing a subscription, you
        authorize us and our payment processor, <B name="PAYMENT_PROCESSOR_NAME" />, to charge the
        payment method you provide on a recurring basis until you cancel.
      </p>
      <p>
        Subscriptions auto-renew at the then-current rate unless you cancel at least{' '}
        <B name="CANCELLATION_NOTICE_PERIOD" /> before the renewal date. You can manage or cancel
        your subscription through <B name="BILLING_PORTAL_LOCATION" />.
      </p>
      <p>
        Refund policy: <B name="REFUND_POLICY_SUMMARY" />. Nothing in this section limits any
        non-waivable statutory rights (for example, consumer-protection rights under{' '}
        <B name="CONSUMER_LAW_REFERENCE" />).
      </p>
      <p>
        Taxes: prices do not include taxes unless stated. You are responsible for any applicable
        sales, use, VAT, GST, or similar taxes.
      </p>

      <h2 style={heading}>7. Third-Party Services and Integrations</h2>
      <p>
        The Service may integrate with third-party platforms (for example, calendar providers,
        messaging platforms, or identity providers). Your use of those platforms is governed by
        their own terms. We are not responsible for third-party services. If a third-party service
        changes its API or terms, we may modify or discontinue the corresponding feature.
      </p>

      <h2 style={heading}>8. Termination</h2>
      <p>
        We may suspend or terminate your access to the Service at any time, with or without notice,
        if we reasonably believe you have violated these Terms, if required by law, or if your
        continued use poses a risk to other users or to the Service. You may stop using the Service
        at any time.
      </p>
      <p>
        Upon termination, sections of these Terms that by their nature should survive (including
        intellectual property, disclaimers, limitation of liability, indemnification, and governing
        law) will survive.
      </p>

      <h2 style={heading}>9. Intellectual Property</h2>
      <p>
        The Service, including its software, design, and trademarks, is owned by Sovio or its
        licensors and is protected by intellectual property laws. We grant you a limited,
        revocable, non-exclusive, non-transferable license to use the Service for personal,
        non-commercial purposes, subject to these Terms.
      </p>
      <p>
        Feedback you provide about the Service may be used by us without obligation, unless you
        mark it as confidential when you submit it.
      </p>

      <h2 style={heading}>10. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT
        WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, TO THE MAXIMUM EXTENT
        PERMITTED BY LAW. WE DISCLAIM IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
        UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT AI OUTPUT WILL BE ACCURATE.
      </p>
      <p>
        Some jurisdictions do not allow the exclusion of certain warranties, so some of the above
        may not apply to you. In those jurisdictions, our liability is limited to the maximum
        extent permitted. See <B name="JURISDICTION_SPECIFIC_WARRANTY_CARVE_OUTS" />.
      </p>

      <h2 style={heading}>11. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOVIO AND ITS OFFICERS, EMPLOYEES, AND AGENTS WILL
        NOT BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, OR FOR
        LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO YOUR USE OF
        THE SERVICE.
      </p>
      <p>
        OUR TOTAL LIABILITY FOR CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS WILL NOT EXCEED THE
        GREATER OF (A) <B name="LIABILITY_CAP_AMOUNT" /> OR (B) THE AMOUNT YOU PAID US IN THE{' '}
        <B name="LIABILITY_CAP_WINDOW" /> PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
      </p>

      <h2 style={heading}>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Sovio and its affiliates from claims, damages, and
        expenses (including reasonable attorneys&rsquo; fees) arising out of (a) your User Content,
        (b) your violation of these Terms, (c) your violation of applicable law, or (d) your
        infringement of any third party&rsquo;s rights.
      </p>

      <h2 style={heading}>13. Governing Law and Dispute Resolution</h2>
      <p>
        These Terms are governed by the laws of <B name="GOVERNING_LAW_JURISDICTION" />, without
        regard to its conflict-of-law rules. Any dispute will be resolved in the courts located in{' '}
        <B name="EXCLUSIVE_VENUE" />, unless <B name="ARBITRATION_OR_CLASS_ACTION_WAIVER_CLAUSE" />{' '}
        applies.
      </p>
      <p>
        If you are a consumer in the European Union, the United Kingdom, or another jurisdiction
        with mandatory local protections, nothing in this section limits your right to bring
        proceedings in your local courts.
      </p>

      <h2 style={heading}>14. Changes to the Service</h2>
      <p>
        We may add, modify, or discontinue features at any time. We will provide reasonable notice
        for material changes that adversely affect paying users, consistent with <B name="SERVICE_CHANGE_POLICY_REFERENCE" />.
      </p>

      <h2 style={heading}>15. Miscellaneous</h2>
      <p>
        These Terms, together with our Privacy Policy and any other policies referenced here, are
        the entire agreement between you and Sovio regarding the Service. If any provision is held
        unenforceable, the remaining provisions will remain in effect. Our failure to enforce a
        right is not a waiver. You may not assign these Terms without our written consent; we may
        assign them in connection with a merger, acquisition, or sale of assets.
      </p>

      <h2 style={heading}>16. Contact</h2>
      <p>
        Questions about these Terms should be directed to <B name="LEGAL_CONTACT_EMAIL" /> or by
        mail to <B name="COMPANY_LEGAL_NAME" />, <B name="COMPANY_MAILING_ADDRESS" />.
      </p>
    </div>
  );
}
