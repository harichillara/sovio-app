'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { PricingTierContent } from '../../content/types';

interface PricingTierProps {
  tier: PricingTierContent;
  emphasized?: boolean;
}

export function PricingTier({ tier, emphasized = false }: PricingTierProps) {
  return (
    <motion.article
      className={`pricing-tier ${emphasized ? 'pricing-tier--emphasized' : ''}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <p className="pricing-tier__name">{tier.name}</p>
      <h2 className="pricing-tier__price">
        {tier.price}
        <span>{tier.cadence}</span>
      </h2>
      <p className="pricing-tier__tagline">{tier.tagline}</p>
      <p className="pricing-tier__description">{tier.description}</p>
      <p className="pricing-tier__emphasis">{tier.emphasis}</p>
      <ul className="pricing-tier__list">
        {tier.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <Link
        href={tier.cta.href}
        className={`cta-link cta-link--${tier.cta.variant}`}
      >
        {tier.cta.label}
      </Link>
    </motion.article>
  );
}
