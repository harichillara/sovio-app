import Link from 'next/link';
import { FeatureStory } from '../components/marketing/FeatureStory';
import { HeroScene } from '../components/marketing/HeroScene';
import { LoopRail } from '../components/marketing/LoopRail';
import { SectionShell } from '../components/marketing/SectionShell';
import { SignalBackground } from '../components/marketing/SignalBackground';
import { WaitlistForm } from '../components/marketing/WaitlistForm';
import {
  heroCtas,
  heroSignals,
  loopSteps,
  marketingFeatures,
  trustPillars,
} from '../content/marketing';

export default function Page() {
  return (
    <>
      <section className="hero-section">
        <SignalBackground />
        <div className="site-frame hero-layout">
          <div className="hero-copy">
            <p className="hero-copy__eyebrow">2040 social operating system</p>
            <h1 className="hero-copy__title">
              The app that feels one step ahead of your life.
            </h1>
            <p className="hero-copy__summary">
              Sovio is an anticipatory layer over your real world. It predicts
              the right move, assembles social momentum, drafts the friction
              away, and turns almost-moments into actual plans.
            </p>
            <div className="hero-copy__actions">
              {heroCtas.map((cta) => (
                <Link
                  key={cta.label}
                  href={cta.href}
                  className={`cta-link cta-link--${cta.variant}`}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
            <div className="hero-copy__meta">
              <span>Intent Cloud</span>
              <span>Presence Score</span>
              <span>Social Momentum</span>
              <span>Reality Replay</span>
            </div>
          </div>
          <HeroScene signals={heroSignals} />
        </div>
      </section>

      <SectionShell
        eyebrow="Core loop"
        title="One loop. Less friction. More life."
        summary="Sovio keeps the product surface intentionally shallow. You open it, see one or two meaningful moves, commit, and leave."
      >
        <LoopRail steps={loopSteps} />
      </SectionShell>

      <SectionShell
        eyebrow="Product systems"
        title="Seven systems designed to feel like one calm intelligence."
        summary="Each layer handles a different kind of social drag: indecision, inertia, silence, missed timing, and the cost of too many tiny choices."
      >
        <div className="feature-stack">
          {marketingFeatures.map((feature, index) => (
            <FeatureStory key={feature.slug} feature={feature} index={index} />
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Trust and control"
        title="Built to feel powerful without feeling reckless."
        summary="Autonomy in Sovio is not magic with no guardrails. The system stays bounded by approvals, risk checks, and sparse product surfaces that keep humans in the loop."
      >
        <div className="trust-grid">
          {trustPillars.map((pillar) => (
            <div key={pillar} className="trust-card">
              {pillar}
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Early access"
        title="Sovio is being tuned for people who want momentum, not more feed time."
        summary="Join the waitlist to get launch access, product drops, and first access to the full momentum layer."
        align="center"
      >
        <div className="waitlist-panel">
          <WaitlistForm source="landing-final" />
          <div className="hero-copy__actions" style={{ marginTop: 18 }}>
            <Link href="/pricing" className="cta-link cta-link--secondary">
              Explore pricing
            </Link>
          </div>
        </div>
      </SectionShell>
    </>
  );
}
