export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          sovio_score: number;
          subscription_tier: 'free' | 'pro';
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          sovio_score?: number;
          subscription_tier?: 'free' | 'pro';
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          sovio_score?: number;
          subscription_tier?: 'free' | 'pro';
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_interests: {
        Row: {
          id: string;
          user_id: string;
          interest: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          interest: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          interest?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_interests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          value: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key?: string;
          value?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          description: string | null;
          location_name: string | null;
          lat: number | null;
          lng: number | null;
          scheduled_at: string | null;
          status: 'draft' | 'active' | 'completed' | 'cancelled';
          ai_generated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description?: string | null;
          location_name?: string | null;
          lat?: number | null;
          lng?: number | null;
          scheduled_at?: string | null;
          status?: 'draft' | 'active' | 'completed' | 'cancelled';
          ai_generated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          description?: string | null;
          location_name?: string | null;
          lat?: number | null;
          lng?: number | null;
          scheduled_at?: string | null;
          status?: 'draft' | 'active' | 'completed' | 'cancelled';
          ai_generated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plans_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_participants: {
        Row: {
          plan_id: string;
          user_id: string;
          status: 'invited' | 'accepted' | 'declined' | 'maybe';
          created_at: string;
        };
        Insert: {
          plan_id: string;
          user_id: string;
          status?: 'invited' | 'accepted' | 'declined' | 'maybe';
          created_at?: string;
        };
        Update: {
          plan_id?: string;
          user_id?: string;
          status?: 'invited' | 'accepted' | 'declined' | 'maybe';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_participants_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      threads: {
        Row: {
          id: string;
          plan_id: string | null;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id?: string | null;
          title: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string | null;
          title?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'threads_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      thread_participants: {
        Row: {
          thread_id: string;
          user_id: string;
          last_read_at: string | null;
        };
        Insert: {
          thread_id: string;
          user_id: string;
          last_read_at?: string | null;
        };
        Update: {
          thread_id?: string;
          user_id?: string;
          last_read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'thread_participants_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'threads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'thread_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          content: string;
          is_ai_draft: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_id: string;
          content: string;
          is_ai_draft?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_id?: string;
          content?: string;
          is_ai_draft?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'threads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_token_usage: {
        Row: {
          id: string;
          user_id: string;
          tokens_used: number;
          period_start: string;
          period_end: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tokens_used?: number;
          period_start: string;
          period_end: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tokens_used?: number;
          period_start?: string;
          period_end?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_token_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_jobs: {
        Row: {
          id: string;
          user_id: string;
          job_type: string;
          status: string;
          result: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_type: string;
          status?: string;
          result?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_type?: string;
          status?: string;
          result?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string;
          event: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      app_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          payload: Json | null;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          payload?: Json | null;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          payload?: Json | null;
          source?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'app_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: string;
          target_type?: string;
          target_id?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      entitlements: {
        Row: {
          id: string;
          user_id: string;
          plan: 'free' | 'pro';
          status: 'active' | 'canceled' | 'past_due' | 'trialing';
          pro_until: string | null;
          current_period_end: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          daily_ai_calls_used: number;
          daily_ai_calls_reset_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: 'free' | 'pro';
          status?: 'active' | 'canceled' | 'past_due' | 'trialing';
          pro_until?: string | null;
          current_period_end?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          daily_ai_calls_used?: number;
          daily_ai_calls_reset_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: 'free' | 'pro';
          status?: 'active' | 'canceled' | 'past_due' | 'trialing';
          pro_until?: string | null;
          current_period_end?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          daily_ai_calls_used?: number;
          daily_ai_calls_reset_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entitlements_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      missed_moments: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'missed_moments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'missed_moments_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          blocked_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
          blocked_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          status?: 'pending' | 'accepted' | 'blocked';
          blocked_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_friend_id_fkey';
            columns: ['friend_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      momentum_availability: {
        Row: {
          id: string;
          user_id: string;
          bucket: string;
          category: string | null;
          available_until: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bucket: string;
          category?: string | null;
          available_until: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bucket?: string;
          category?: string | null;
          available_until?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'momentum_availability_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      presence_daily: {
        Row: {
          id: string;
          user_id: string;
          day: string;
          score: number;
          activity_score: number;
          social_score: number;
          movement_score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          score: number;
          activity_score: number;
          social_score: number;
          movement_score: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          score?: number;
          activity_score?: number;
          social_score?: number;
          movement_score?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'presence_daily_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
            },
          ];
        };
      weekly_insights: {
        Row: {
          id: string;
          user_id: string;
          week_of: string;
          insight: string;
          experiment: string | null;
          experiment_done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_of: string;
          insight: string;
          experiment?: string | null;
          experiment_done?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_of?: string;
          insight?: string;
          experiment?: string | null;
          experiment_done?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weekly_insights_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: 'ios' | 'android' | 'web';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          content_type: string;
          content_id: string;
          reported_user_id: string | null;
          reason: string;
          details: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          content_type: string;
          content_id: string;
          reported_user_id?: string | null;
          reason: string;
          details?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          content_type?: string;
          content_id?: string;
          reported_user_id?: string | null;
          reason?: string;
          details?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reported_user_id_fkey';
            columns: ['reported_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      suggestions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          summary: string;
          type: 'plan' | 'place' | 'group';
          status: 'new' | 'accepted' | 'dismissed' | 'expired';
          confidence: number;
          dismiss_reason: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          summary: string;
          type: 'plan' | 'place' | 'group';
          status?: 'new' | 'accepted' | 'dismissed' | 'expired';
          confidence?: number;
          dismiss_reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          summary?: string;
          type?: 'plan' | 'place' | 'group';
          status?: 'new' | 'accepted' | 'dismissed' | 'expired';
          confidence?: number;
          dismiss_reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'suggestions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_tier: 'free' | 'pro';
      plan_status: 'draft' | 'active' | 'completed' | 'cancelled';
      participant_status: 'invited' | 'accepted' | 'declined' | 'maybe';
      friendship_status: 'pending' | 'accepted' | 'blocked';
      push_platform: 'ios' | 'android' | 'web';
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
        PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;
