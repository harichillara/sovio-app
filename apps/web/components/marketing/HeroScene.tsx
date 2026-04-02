'use client';

import { motion } from 'framer-motion';

interface HeroSceneProps {
  signals: string[];
}

export function HeroScene({ signals }: HeroSceneProps) {
  return (
    <div className="hero-scene">
      <div className="hero-scene__label">
        <span className="hero-scene__label-kicker">Intent field</span>
        <span className="hero-scene__label-note">Live social patterning</span>
      </div>
      <div className="hero-scene__axis hero-scene__axis--x" />
      <div className="hero-scene__axis hero-scene__axis--y" />
      <motion.div
        className="hero-scene__core"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="hero-scene__halo hero-scene__halo--outer" />
        <div className="hero-scene__halo hero-scene__halo--inner" />
        <div className="hero-scene__node" />
        <div className="hero-scene__ring hero-scene__ring--one" />
        <div className="hero-scene__ring hero-scene__ring--two" />
      </motion.div>

      {signals.map((signal, index) => (
        <motion.div
          key={signal}
          className={`hero-scene__signal hero-scene__signal--${index + 1}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 + index * 0.12 }}
        >
          <span className="hero-scene__signal-dot" />
          <span>{signal}</span>
        </motion.div>
      ))}
    </div>
  );
}
