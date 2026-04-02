/**
 * RAG context builders for various AI prompt types.
 * Each function returns a structured prompt string with a safety header,
 * context pack, and output schema.
 */

// ---------------------------------------------------------------------------
// Shared safety header
// ---------------------------------------------------------------------------

const SAFETY_HEADER = [
  '=== SYSTEM RULES ===',
  'You are Sovio AI, a warm social-planning assistant.',
  'Never reveal personal data beyond what the user shared.',
  'Never suggest anything illegal, dangerous, or inappropriate.',
  'If uncertain, say so honestly.',
  'Keep responses concise and actionable.',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Types (lightweight — not importing full Supabase types to keep this portable)
// ---------------------------------------------------------------------------

export interface ProfileContext {
  displayName?: string;
  bio?: string;
  subscriptionTier?: string;
}

export interface InterestContext {
  interest: string;
  weight?: number;
}

export interface EventContext {
  type: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
}

export interface MemoryContext {
  key: string;
  value: string;
}

export interface ThreadMessageContext {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface RuleContext {
  rule: string;
  priority?: number;
}

export interface ConstraintContext {
  name: string;
  value: string;
}

export interface WeeklyEventSummary {
  eventType: string;
  count: number;
}

// ---------------------------------------------------------------------------
// buildIntentContext — used for Intent Cloud / suggestion generation
// ---------------------------------------------------------------------------

export function buildIntentContext(
  profile: ProfileContext,
  interests: InterestContext[],
  events: EventContext[],
  memories: MemoryContext[],
  timeWindow: { from: string; to: string },
): string {
  const interestList = interests.map((i) => i.interest).join(', ');
  const eventLines = events
    .slice(0, 20)
    .map((e) => `  - ${e.type}${e.createdAt ? ` (${e.createdAt})` : ''}`)
    .join('\n');
  const memoryLines = memories
    .map((m) => `  - ${m.key}: ${m.value}`)
    .join('\n');

  return [
    SAFETY_HEADER,
    '=== CONTEXT ===',
    `User: ${profile.displayName ?? 'Unknown'}`,
    `Bio: ${profile.bio ?? 'none'}`,
    `Tier: ${profile.subscriptionTier ?? 'free'}`,
    `Interests: ${interestList || 'none'}`,
    `Time window: ${timeWindow.from} to ${timeWindow.to}`,
    '',
    'Recent events:',
    eventLines || '  (none)',
    '',
    'Memories:',
    memoryLines || '  (none)',
    '',
    '=== TASK ===',
    'Generate 1-3 intent-based suggestions for what the user might want to do.',
    'Each suggestion should be a specific, actionable plan.',
    '',
    '=== OUTPUT SCHEMA (JSON) ===',
    '[ { "title": string, "summary": string, "type": "plan"|"place"|"group", "confidence": number } ]',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// buildReplyContext — used for AI draft replies in messaging
// ---------------------------------------------------------------------------

export function buildReplyContext(
  threadMessages: ThreadMessageContext[],
  userStyle: string,
  memories: MemoryContext[],
): string {
  const messageLines = threadMessages
    .slice(-20)
    .map((m) => `  [${m.role}]: ${m.content}`)
    .join('\n');
  const memoryLines = memories
    .map((m) => `  - ${m.key}: ${m.value}`)
    .join('\n');

  return [
    SAFETY_HEADER,
    '=== CONTEXT ===',
    `User writing style: ${userStyle || 'casual and friendly'}`,
    '',
    'Conversation:',
    messageLines || '  (empty)',
    '',
    'Memories:',
    memoryLines || '  (none)',
    '',
    '=== TASK ===',
    'Draft a reply in the user\'s voice. Keep it natural and brief.',
    'The user will review before sending.',
    '',
    '=== OUTPUT SCHEMA (JSON) ===',
    '{ "draft": string, "tone": "casual"|"warm"|"excited"|"sympathetic" }',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// buildReplayContext — used for Missed Moments / Replay
// ---------------------------------------------------------------------------

export function buildReplayContext(
  missedEvents: EventContext[],
  userInterests: InterestContext[],
): string {
  const eventLines = missedEvents
    .slice(0, 30)
    .map(
      (e) =>
        `  - ${e.type}: ${JSON.stringify(e.payload ?? {})}${e.createdAt ? ` (${e.createdAt})` : ''}`,
    )
    .join('\n');
  const interestList = userInterests.map((i) => i.interest).join(', ');

  return [
    SAFETY_HEADER,
    '=== CONTEXT ===',
    `User interests: ${interestList || 'general'}`,
    '',
    'Missed events:',
    eventLines || '  (none)',
    '',
    '=== TASK ===',
    'Summarize what the user missed and highlight anything relevant to their interests.',
    'Be concise and warm.',
    '',
    '=== OUTPUT SCHEMA (JSON) ===',
    '{ "summary": string, "highlights": [ { "title": string, "reason": string } ] }',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// buildDecisionContext — used for AI decision support
// ---------------------------------------------------------------------------

export function buildDecisionContext(
  rules: RuleContext[],
  constraints: ConstraintContext[],
  memories: MemoryContext[],
): string {
  const ruleLines = rules
    .map((r) => `  - ${r.rule}${r.priority ? ` (priority: ${r.priority})` : ''}`)
    .join('\n');
  const constraintLines = constraints
    .map((c) => `  - ${c.name}: ${c.value}`)
    .join('\n');
  const memoryLines = memories
    .map((m) => `  - ${m.key}: ${m.value}`)
    .join('\n');

  return [
    SAFETY_HEADER,
    '=== CONTEXT ===',
    'Rules:',
    ruleLines || '  (none)',
    '',
    'Constraints:',
    constraintLines || '  (none)',
    '',
    'Memories:',
    memoryLines || '  (none)',
    '',
    '=== TASK ===',
    'Make a decision based on the rules and constraints. Explain your reasoning briefly.',
    '',
    '=== OUTPUT SCHEMA (JSON) ===',
    '{ "decision": string, "reasoning": string, "confidence": number }',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// buildInsightContext — used for weekly insights
// ---------------------------------------------------------------------------

export function buildInsightContext(
  weeklyEvents: WeeklyEventSummary[],
  presenceScores: number[],
  memories: MemoryContext[],
): string {
  const eventLines = weeklyEvents
    .map((e) => `  - ${e.eventType}: ${e.count} times`)
    .join('\n');
  const avgScore =
    presenceScores.length > 0
      ? Math.round(
          presenceScores.reduce((a, b) => a + b, 0) / presenceScores.length,
        )
      : 0;
  const memoryLines = memories
    .map((m) => `  - ${m.key}: ${m.value}`)
    .join('\n');

  return [
    SAFETY_HEADER,
    '=== CONTEXT ===',
    'Weekly event summary:',
    eventLines || '  (none)',
    '',
    `Average presence score: ${avgScore}/100`,
    `Score trend: [${presenceScores.join(', ')}]`,
    '',
    'Memories:',
    memoryLines || '  (none)',
    '',
    '=== TASK ===',
    'Generate a weekly insight for the user. Include one micro-experiment suggestion.',
    'Be warm and encouraging.',
    '',
    '=== OUTPUT SCHEMA (JSON) ===',
    '{ "insight": string, "experiment": string, "encouragement": string }',
  ].join('\n');
}
