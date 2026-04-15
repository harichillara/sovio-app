/**
 * App-level narrow types for DB columns that use bare `string` in the
 * auto-generated database.types.ts. These provide compile-time safety
 * without modifying the generated file.
 */

export type AiJobType = 'suggestion' | 'autopilot' | 'insight';
export type AiJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'approved' | 'rejected';
export type AuditTargetType = 'profile' | 'plan' | 'message' | 'thread' | 'suggestion';
export type AvailabilityMode = 'active' | 'passive' | 'scheduled';
export type ConfidenceLabel = 'high' | 'medium' | 'low';
export type MomentumSource = 'manual' | 'geofence' | 'schedule' | 'ai';
export type SharingMode = 'precise' | 'approximate' | 'hidden';
export type ReportContentType = 'message' | 'plan' | 'profile' | 'suggestion';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';
