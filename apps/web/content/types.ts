export interface HeroCTA {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

export interface MarketingFeature {
  slug: string;
  label: string;
  title: string;
  summary: string;
  proof: string;
  cta: string;
  visual:
    | 'intent'
    | 'presence'
    | 'messenger'
    | 'autopilot'
    | 'momentum'
    | 'replay'
    | 'insight';
}

export interface PricingTierContent {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  description: string;
  emphasis: string;
  cta: HeroCTA;
  features: string[];
}

export interface WaitlistSignupInput {
  email: string;
  source: string;
  referrer?: string;
}
