'use client';

import { motion } from 'framer-motion';
import type { MarketingFeature } from '../../content/types';

interface FeatureStoryProps {
  feature: MarketingFeature;
  index: number;
}

function FeatureVisual({ feature }: { feature: MarketingFeature }) {
  switch (feature.visual) {
    case 'intent':
      return (
        <div className="feature-visual feature-visual--intent">
          <span className="feature-pill">Thursday vector</span>
          <span className="feature-pill">2 mutuals nearby</span>
          <span className="feature-pill">Low-friction plan</span>
        </div>
      );
    case 'presence':
      return (
        <div className="feature-visual feature-visual--presence">
          <div className="presence-meter">
            <div className="presence-meter__bar" style={{ width: '82%' }} />
            <div className="presence-meter__score">82</div>
            <div className="presence-meter__delta">+14 from yesterday</div>
          </div>
        </div>
      );
    case 'messenger':
      return (
        <div className="feature-visual feature-visual--messenger">
          <div className="message-thread">
            <div className="message-thread__bubble">
              Want to do something after work?
            </div>
            <div className="message-thread__bubble message-thread__bubble--accent">
              I can do 7:30. Sovio already found a spot halfway.
            </div>
          </div>
        </div>
      );
    case 'autopilot':
      return (
        <div className="feature-visual feature-visual--autopilot">
          <div className="decision-stack">
            <span>Primary: coffee within 10 min</span>
            <span>Backup: rooftop if weather holds</span>
            <span>Fallback: stay local and shorten duration</span>
          </div>
        </div>
      );
    case 'momentum':
      return (
        <div className="feature-visual feature-visual--momentum">
          <div className="momentum-orbit">
            <span className="momentum-orbit__point momentum-orbit__point--one" />
            <span className="momentum-orbit__point momentum-orbit__point--two" />
            <span className="momentum-orbit__point momentum-orbit__point--three" />
            <span className="momentum-orbit__center">Group locked</span>
          </div>
        </div>
      );
    case 'replay':
      return (
        <div className="feature-visual feature-visual--replay">
          <div className="replay-timeline">
            <span>You missed a live set 0.4 miles away.</span>
            <span>Convert it to tonight in one tap.</span>
          </div>
        </div>
      );
    case 'insight':
      return (
        <div className="feature-visual feature-visual--insight">
          <div className="insight-wave" />
          <div className="insight-copy">
            You are most social on Thursdays. Protect that window.
          </div>
        </div>
      );
  }
}

export function FeatureStory({ feature, index }: FeatureStoryProps) {
  const reversed = index % 2 === 1;

  return (
    <motion.article
      className={`feature-story ${reversed ? 'feature-story--reversed' : ''}`}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: 'easeOut' }}
    >
      <div className="feature-story__copy">
        <p className="feature-story__label">{feature.label}</p>
        <h3 className="feature-story__title">{feature.title}</h3>
        <p className="feature-story__summary">{feature.summary}</p>
        <p className="feature-story__proof">{feature.proof}</p>
        <span className="feature-story__cta">{feature.cta}</span>
      </div>
      <FeatureVisual feature={feature} />
    </motion.article>
  );
}
