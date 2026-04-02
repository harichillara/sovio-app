export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  plans: (filters?: Record<string, unknown>) => ['plans', filters] as const,
  plan: (planId: string) => ['plan', planId] as const,
  threads: (userId: string) => ['threads', userId] as const,
  messages: (threadId: string) => ['messages', threadId] as const,
  aiTokens: (userId: string) => ['ai-tokens', userId] as const,
  friends: (userId: string) => ['friends', userId] as const,
  friendRequests: (userId: string) => ['friend-requests', userId] as const,
  missedMoments: (userId: string) => ['missed-moments', userId] as const,
};
