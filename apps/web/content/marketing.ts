import type {
  HeroCTA,
  MarketingFeature,
  PricingTierContent,
} from './types';

export const heroCtas: HeroCTA[] = [
  {
    label: 'Join the waitlist',
    href: '/waitlist',
    variant: 'primary',
  },
  {
    label: 'See pricing',
    href: '/pricing',
    variant: 'secondary',
  },
];

export const heroSignals = [
  'Thursday pattern detected',
  '2 mutuals free nearby',
  'Low-friction night out',
  'Presence dip for 3 days',
  'Replay worth converting',
];

export const loopSteps = [
  'Intent Cloud',
  'Social Momentum',
  'AI Messaging',
  'Reality Replay',
  'Strategic Insight',
];

export const marketingFeatures: MarketingFeature[] = [
  {
    slug: 'intent-cloud',
    label: 'Intent Cloud',
    title: 'Sovio predicts the moment before you reach for it.',
    summary:
      'Instead of asking you what to do, Sovio notices your patterns, your people, and your timing, then surfaces one move worth making now.',
    proof:
      'Built for anticipation, not discovery. The home surface stays capped, sharp, and personal.',
    cta: 'Preview predictive flow',
    visual: 'intent',
  },
  {
    slug: 'presence-score',
    label: 'Presence Score',
    title: 'A visible score for how much life you actually lived today.',
    summary:
      'Movement, novelty, outdoor time, social energy, and recovery become a clean signal that rewards action instead of passive drift.',
    proof:
      'The mechanic is addictive because it is explainable, social, and slightly provocative.',
    cta: 'See score logic',
    visual: 'presence',
  },
  {
    slug: 'ai-clone-messenger',
    label: 'AI Clone Messenger',
    title: 'Reply faster without becoming a worse friend.',
    summary:
      'Sovio drafts in your voice, filters low-value noise, and keeps social momentum alive while high-risk threads always stay in your hands.',
    proof:
      'The system is assistive first, policy-bound, and designed for reviewable autonomy.',
    cta: 'Explore clone mode',
    visual: 'messenger',
  },
  {
    slug: 'decision-autopilot',
    label: 'Decision Autopilot',
    title: 'The small decisions disappear so your energy stays for real life.',
    summary:
      'Pick the venue, pick the time, pick the fallback. Sovio narrows the branch tree into one confident move and two clean backups.',
    proof:
      'Rules, constraints, and approvals keep the system useful without making it reckless.',
    cta: 'Open decision engine',
    visual: 'autopilot',
  },
  {
    slug: 'social-momentum',
    label: 'Social Momentum',
    title: 'Planning friction drops because Sovio forms the plan for you.',
    summary:
      'When several people want the same night, Sovio can assemble the group, propose the venue, lock the time, and open the thread.',
    proof:
      'This is the core wedge: not “what is happening,” but “it is already happening.”',
    cta: 'Watch group formation',
    visual: 'momentum',
  },
  {
    slug: 'reality-replay',
    label: 'Reality Replay',
    title: 'Missed moments come back as a smarter second chance.',
    summary:
      'Sovio turns FOMO into action by resurfacing nearby moments you almost touched and giving you one tap to convert them into a plan.',
    proof:
      'Replay is short, daily, and useful. No archive spiral, no feed debt.',
    cta: 'See replay recap',
    visual: 'replay',
  },
  {
    slug: 'strategic-insight',
    label: 'Strategic Insight',
    title: 'Your week closes with one honest insight and one better next move.',
    summary:
      'Sovio spots patterns like “you are most social on Thursdays” or “you default local when novelty would energize you” and turns them into experiments.',
    proof:
      'Insight is intentionally sparse so it feels like coaching, not content.',
    cta: 'Read weekly coach',
    visual: 'insight',
  },
];

export const trustPillars = [
  'Autonomy is opt-in and bounded by approvals.',
  'High-risk messaging never sends itself.',
  'Location and presence stay coarse, private, and controllable.',
  'The product is designed to reduce app time, not inflate it.',
];

export const pricingTiers: PricingTierContent[] = [
  {
    name: 'Assistive Layer',
    price: '$0',
    cadence: '/month',
    tagline: 'For people who want a sharper social surface.',
    description:
      'The free layer gives you Sovio’s anticipatory shell: predictive ideas, limited AI help, and the first loop of Replay and Momentum.',
    emphasis: 'Enough to feel the system shift.',
    cta: {
      label: 'Start with the waitlist',
      href: '/waitlist',
      variant: 'secondary',
    },
    features: [
      'Intent Cloud with curated daily suggestions',
      'Base Presence Score and streak cues',
      'Limited AI drafts and planning assists',
      'Reality Replay for recent missed moments',
      'Soft quota on AI momentum actions',
    ],
  },
  {
    name: 'Momentum Layer',
    price: '$6.99',
    cadence: '/month',
    tagline: 'For people who want the full anticipatory stack.',
    description:
      'Pro unlocks deeper memory, faster generation, stronger replay depth, and priority handling across drafting, nudges, and momentum flows.',
    emphasis: 'This is where Sovio feels alive.',
    cta: {
      label: 'Get early Pro access',
      href: '/waitlist',
      variant: 'primary',
    },
    features: [
      'Priority AI generation lane',
      'Expanded replay horizon and richer memory',
      'Higher token ceiling for planning and reply assist',
      'Decision Autopilot proposals with smarter backups',
      'Advanced social momentum orchestration',
      'Weekly Strategic Insight coaching',
    ],
  },
];
