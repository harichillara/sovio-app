// Request-body schemas for `ai-generate`, extracted into a pure module so
// they can be unit-tested without pulling in the handler's DB + Sentry
// side-effects at module load.
//
// A discriminated union on `op` lets each op declare its own required/optional
// fields. Field names and types are cross-checked against each handler's body
// access in index.ts. Free-form user text is capped (`.max`) to prevent
// prompt-bloat DoS against Gemini. Cron ops are schema'd even though they go
// through requireServiceRole — defense in depth.

import { z } from '../_shared/validate.ts';

export const IntentBodySchema = z.object({
  op: z.literal('intent'),
  userId: z.string().uuid(),
});

export const ReplyDraftBodySchema = z.object({
  op: z.literal('reply_draft'),
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
});

export const ReplayBodySchema = z.object({
  op: z.literal('replay'),
  userId: z.string().uuid(),
});

export const WeeklyInsightBodySchema = z.object({
  op: z.literal('weekly_insight'),
  userId: z.string().uuid(),
});

export const DecisionProposalBodySchema = z.object({
  op: z.literal('decision_proposal'),
  userId: z.string().uuid(),
  constraints: z
    .object({
      budget: z.string().max(200).optional(),
      maxTravel: z.number().int().nonnegative().max(10_000).optional(),
      preferredTimes: z.array(z.string().max(64)).max(20).optional(),
      groupSize: z.array(z.string().max(64)).max(20).optional(),
    })
    .optional(),
});

// Cron ops: body must be a bare `{ op: "..." }` — the handlers ignore any
// other fields, but we lock the shape down anyway.
export const CronSuggestionsBodySchema = z.object({ op: z.literal('cron_suggestions') });
export const CronPresenceBodySchema = z.object({ op: z.literal('cron_presence') });
export const CronReplayBodySchema = z.object({ op: z.literal('cron_replay') });
export const CronWeeklyInsightBodySchema = z.object({ op: z.literal('cron_weekly_insight') });
export const CronCleanupBodySchema = z.object({ op: z.literal('cron_cleanup') });
export const CronRetentionBodySchema = z.object({ op: z.literal('cron_retention') });
// Worker op — drains the ai_jobs queue. Called every minute by pg_cron.
export const CronWorkerBodySchema = z.object({ op: z.literal('cron_worker') });

export const AiGenerateBodySchema = z.discriminatedUnion('op', [
  IntentBodySchema,
  ReplyDraftBodySchema,
  ReplayBodySchema,
  WeeklyInsightBodySchema,
  DecisionProposalBodySchema,
  CronSuggestionsBodySchema,
  CronPresenceBodySchema,
  CronReplayBodySchema,
  CronWeeklyInsightBodySchema,
  CronCleanupBodySchema,
  CronRetentionBodySchema,
  CronWorkerBodySchema,
]);

export type AiGenerateBody = z.infer<typeof AiGenerateBodySchema>;
