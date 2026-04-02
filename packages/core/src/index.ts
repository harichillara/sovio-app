// Brand & onboarding
export * from './brand';
export * from './onboarding';

// Supabase client & types
export { supabase } from './supabase/client';
export type * from './supabase/types';

// Services
export * as authService from './services/auth.service';
export * as profileService from './services/profile.service';
export * as plansService from './services/plans.service';
export * as messagesService from './services/messages.service';
export * as aiService from './services/ai.service';
export * as locationService from './services/location.service';
export * as notificationsService from './services/notifications.service';
export * as friendshipsService from './services/friendships.service';

// Stores
export { useAuthStore } from './stores/auth.store';
export { usePlansStore } from './stores/plans.store';
export { useMessagesStore } from './stores/messages.store';
export { useAIStore } from './stores/ai.store';
export { useLocationStore } from './stores/location.store';

// Hooks
export { queryKeys } from './hooks/queryKeys';
export * from './hooks/useAuth';
export * from './hooks/usePlans';
export * from './hooks/useMessages';
export * from './hooks/useProfile';
export * from './hooks/useAITokens';
export * from './hooks/useFriends';
export * from './hooks/useMissedMoments';

// Providers
export { QueryProvider, queryClient } from './providers/QueryProvider';
export { AuthProvider } from './providers/AuthProvider';
export { RealtimeProvider } from './providers/RealtimeProvider';
