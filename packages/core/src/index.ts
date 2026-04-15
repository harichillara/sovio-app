// Brand & onboarding
export * from './brand';
export * from './onboarding';

// Supabase client & types
export { supabase } from './supabase/client';
export type * from './supabase/types';
export type * from './supabase/app-types';

// AI foundation
export type * from './ai/llm-client';
export { GeminiClient } from './ai/gemini-client';
export * from './ai/context-builder';

// Services
export * as authService from './services/auth.service';
export * as profileService from './services/profile.service';
export * as plansService from './services/plans.service';
export * as messagesService from './services/messages.service';
export * as aiService from './services/ai.service';
export * as locationService from './services/location.service';
export * as notificationsService from './services/notifications.service';
export * as friendshipsService from './services/friendships.service';
export * as suggestionsService from './services/suggestions.service';
export * as eventsService from './services/events.service';
export * as presenceService from './services/presence.service';
export * as momentumService from './services/momentum.service';
export * as moderationService from './services/moderation.service';
export * as entitlementsService from './services/entitlements.service';
export * as autopilotService from './services/autopilot.service';
export * as billingService from './services/billing.service';

// Stores
export { useAuthStore } from './stores/auth.store';
export { usePlansStore } from './stores/plans.store';
export { useMessagesStore } from './stores/messages.store';
export { useAIStore } from './stores/ai.store';
export { useLocationStore } from './stores/location.store';
export { useSuggestionsStore } from './stores/suggestions.store';
export { usePresenceStore } from './stores/presence.store';

// Hooks
export { queryKeys } from './hooks/queryKeys';
export * from './hooks/useAuth';
export * from './hooks/usePlans';
export * from './hooks/useMessages';
export * from './hooks/useProfile';
export * from './hooks/useAITokens';
export * from './hooks/useFriends';
export * from './hooks/useMissedMoments';
export * from './hooks/useSuggestions';
export * from './hooks/usePresence';
export * from './hooks/useMomentum';
export * from './hooks/useEntitlements';
export * from './hooks/useEvents';
export * from './hooks/useAutopilot';
export * from './hooks/useBilling';
export * from './hooks/useNotificationCenter';

// Providers
export { QueryProvider, queryClient } from './providers/QueryProvider';
export { AuthProvider } from './providers/AuthProvider';
export { RealtimeProvider } from './providers/RealtimeProvider';
