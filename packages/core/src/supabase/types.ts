import type { Database } from './database.types';

// Row types (read)
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Plan = Database['public']['Tables']['plans']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Thread = Database['public']['Tables']['threads']['Row'];
export type PlanParticipant = Database['public']['Tables']['plan_participants']['Row'];
export type ThreadParticipant = Database['public']['Tables']['thread_participants']['Row'];
export type UserInterest = Database['public']['Tables']['user_interests']['Row'];
export type UserPreference = Database['public']['Tables']['user_preferences']['Row'];
export type AITokenUsage = Database['public']['Tables']['ai_token_usage']['Row'];
export type MissedMoment = Database['public']['Tables']['missed_moments']['Row'];
export type Friendship = Database['public']['Tables']['friendships']['Row'];
export type PushToken = Database['public']['Tables']['push_tokens']['Row'];

// Insert types (create)
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type PlanInsert = Database['public']['Tables']['plans']['Insert'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type ThreadInsert = Database['public']['Tables']['threads']['Insert'];
export type PlanParticipantInsert = Database['public']['Tables']['plan_participants']['Insert'];
export type ThreadParticipantInsert = Database['public']['Tables']['thread_participants']['Insert'];
export type UserInterestInsert = Database['public']['Tables']['user_interests']['Insert'];
export type UserPreferenceInsert = Database['public']['Tables']['user_preferences']['Insert'];
export type AITokenUsageInsert = Database['public']['Tables']['ai_token_usage']['Insert'];
export type MissedMomentInsert = Database['public']['Tables']['missed_moments']['Insert'];
export type FriendshipInsert = Database['public']['Tables']['friendships']['Insert'];
export type PushTokenInsert = Database['public']['Tables']['push_tokens']['Insert'];

// Update types (patch)
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type PlanUpdate = Database['public']['Tables']['plans']['Update'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];
export type ThreadUpdate = Database['public']['Tables']['threads']['Update'];
export type PlanParticipantUpdate = Database['public']['Tables']['plan_participants']['Update'];
export type ThreadParticipantUpdate = Database['public']['Tables']['thread_participants']['Update'];
export type UserInterestUpdate = Database['public']['Tables']['user_interests']['Update'];
export type UserPreferenceUpdate = Database['public']['Tables']['user_preferences']['Update'];
export type AITokenUsageUpdate = Database['public']['Tables']['ai_token_usage']['Update'];
export type MissedMomentUpdate = Database['public']['Tables']['missed_moments']['Update'];
export type FriendshipUpdate = Database['public']['Tables']['friendships']['Update'];
export type PushTokenUpdate = Database['public']['Tables']['push_tokens']['Update'];

// Re-export the Database type itself
export type { Database };
