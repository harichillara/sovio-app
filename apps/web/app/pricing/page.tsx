import { PricingTier } from '../../components/marketing/PricingTier';
import { SectionShell } from '../../components/marketing/SectionShell';
import { SignalBackground } from '../../components/marketing/SignalBackground';
import { WaitlistForm } from '../../components/marketing/WaitlistForm';
import { pricingTiers } from '../../content/marketing';

export default function PricingPage() {
  return (
    <>
      <section className="hero-section" style={{ minHeight: 'auto' }}>
        <SignalBackground />
        <div className="site-frame split-hero">
          <div className="split-hero__copy">
            <p className="hero-copy__eyebrow">Pricing</p>
            <h1 className="split-hero__title">
              Two layers. One anticipatory system.
            </h1>
            <p className="split-hero__summary">
              Sovio starts with a strong assistive shell, then opens into a
              deeper momentum layer when you want more generation, more replay,
              and a sharper planning engine.
            </p>
          </div>
          <WaitlistForm source="pricing-hero" compact />
        </div>
      </section>

      <SectionShell
        eyebrow="Plans"
        title="Choose the level of momentum you want Sovio to carry for you."
        summary="The free layer lets you feel the system. Pro is where the predictive, replay, and planning stack starts to compound."
      >
        <div className="pricing-grid">
          <PricingTier tier={pricingTiers[0]} />
          <PricingTier tier={pricingTiers[1]} emphasized />
        </div>
        <p className="pricing-note">
          Pricing is designed around AI intensity, replay depth, and priority
          handling, not around bloating the product with more tabs or feed
          mechanics.
        </p>
      </SectionShell>
    </>
  );
}
