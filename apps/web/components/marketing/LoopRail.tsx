'use client';

import { motion } from 'framer-motion';

interface LoopRailProps {
  steps: string[];
}

export function LoopRail({ steps }: LoopRailProps) {
  return (
    <div className="loop-rail">
      {steps.map((step, index) => (
        <motion.div
          key={step}
          className="loop-rail__step"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.55, delay: index * 0.08 }}
        >
          <span className="loop-rail__index">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="loop-rail__label">{step}</span>
        </motion.div>
      ))}
    </div>
  );
}
