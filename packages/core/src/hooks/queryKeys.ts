export const queryKeys = {
  // Existing
  profile: (userId: string) => ['profile', userId] as const,
  plans: (filters?: Record<string, unknown>) => ['plans', filters] as const,
  plan: (planId: string) => ['plan', planId] as const,
  threads: (userId: string) => ['threads', userId] as const,
  messages: (threadId: string) => ['messages', threadId] as const,
  aiTokens: (userId: string) => ['ai-tokens', userId] as const,
  friends: (userId: string) => ['friends', userId] as const,
  friendRequests: (userId: string) => ['friend-requests', userId] as const,
  missedMoments: (userId: string) => ['missed-moments', userId] as const,

  // Sprint 1 additions
  suggestions: (userId: string) => ['suggestions', userId] as const,
  presence: (userId: string, day?: string) =>
    ['presence', userId, day] as const,
  presenceHistory: (userId: string, days: number) =>
    ['presence-history', userId, days] as const,
  momentum: (userId: string) => ['momentum', userId] as const,
  entitlements: (userId: string) => ['entitlements', userId] as const,
  events: (userId: string) => ['events', userId] as const,
  insights: (userId: string, weekOf?: string) =>
    ['insights', userId, weekOf] as const,
};
