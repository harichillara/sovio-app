/**
 * App-level narrow types for DB columns that use bare `string` in the
 * auto-generated database.types.ts. These provide compile-time safety
 * without modifying the generated file.
 */

export type AiJobType = 'suggestion' | 'autopilot' | 'insight';
export type AiJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'approved' | 'rejected';
export type AuditTargetType = 'profile' | 'plan' | 'message' | 'thread' | 'suggestion';
export type AvailabilityMode = 'open_now' | 'passive' | 'scheduled';
export type ConfidenceLabel = 'open_to_plans' | 'availability_unknown';
export type MomentumSource = 'manual' | 'device_location' | 'geofence' | 'schedule' | 'ai';
export type SharingMode = 'precise' | 'approx' | 'hidden';
export type ReportContentType = 'message' | 'plan' | 'profile' | 'suggestion';
export type ReportReason =
  | 'Spam or scam'
  | 'Harassment or bullying'
  | 'Inappropriate content'
  | 'Impersonation'
  | 'Violence or threat'
  | 'Self-harm'
  | 'Other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';
