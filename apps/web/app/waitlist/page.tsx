import Link from 'next/link';
import { SectionShell } from '../../components/marketing/SectionShell';
import { SignalBackground } from '../../components/marketing/SignalBackground';
import { WaitlistForm } from '../../components/marketing/WaitlistForm';

export default function WaitlistPage() {
  return (
    <>
      <section className="hero-section" style={{ minHeight: 'auto' }}>
        <SignalBackground />
        <div className="site-frame split-hero">
          <div className="split-hero__copy">
            <p className="hero-copy__eyebrow">Waitlist</p>
            <h1 className="split-hero__title">
              Get inside before Sovio opens wider.
            </h1>
            <p className="split-hero__summary">
              Join the list for launch access, product previews, pricing drops,
              and first access to the momentum layer as it comes online.
            </p>
          </div>
          <WaitlistForm source="waitlist-page" compact />
        </div>
      </section>

      <SectionShell
        eyebrow="What you get"
        title="Early access means seeing the system before it flattens into a category."
        summary="You will be first to experience the living home surface, the replay loop, and the first versions of clone messaging and momentum orchestration."
      >
        <div className="trust-grid">
          {[
            'Launch access before broad rollout',
            'First pricing and product updates',
            'Preview drops for the predictive home surface',
            'Priority invites for Sovio Pro testing',
          ].map((item) => (
            <div key={item} className="trust-card">
              {item}
            </div>
          ))}
        </div>
        <div className="hero-copy__actions" style={{ marginTop: 28 }}>
          <Link href="/" className="cta-link cta-link--secondary">
            Back to the product story
          </Link>
          <Link href="/pricing" className="cta-link cta-link--primary">
            See pricing
          </Link>
        </div>
      </SectionShell>
    </>
  );
}
