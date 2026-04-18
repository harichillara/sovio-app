// ---------------------------------------------------------------------------
// eventBuffer — client-side batcher for app_events inserts
// ---------------------------------------------------------------------------
//
// Why this exists:
//   Every client action (home_viewed, plan_created, suggestion_accepted, ...)
//   fires a single-row INSERT into app_events. At scale that produces write
//   contention on the hot end of the table and inflates pg_stat_statements.
//
//   This buffer coalesces events on the client and flushes them as a single
//   multi-row INSERT. The server still validates each row via RLS, so this
//   is a pure performance change — semantics are identical.
//
// Flush triggers (whichever comes first):
//   * max batch size  (MAX_BATCH_SIZE, default 20)
//   * max batch age   (FLUSH_INTERVAL_MS, default 2000ms since FIRST event
//                      in the current buffer — NOT since the last event,
//                      otherwise a steady trickle would never flush)
//   * manual flushEvents() call (e.g. right before sign-out)
//   * window `beforeunload` (web) — best-effort drain on tab close
//   * React Native AppState transition to background/inactive
//
// Failure policy:
//   Analytics are NOT critical. If the insert fails we log once and DROP the
//   batch. We DO NOT retry, because:
//     1. unbounded retry on the client is a DoS against our own backend,
//     2. the user's action has already happened locally — we'd rather lose
//        a breadcrumb than lock up their UI or burn their battery.
//   A drop counter is exposed for tests and debug panels.
// ---------------------------------------------------------------------------

import { supabase } from '../supabase/client';
import type { Json } from '../supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BufferedEvent {
  user_id: string;
  event_type: string;
  payload?: Json | null;
  source?: string | null;
}

export interface EventBufferConfig {
  maxBatchSize: number;
  flushIntervalMs: number;
}

export const DEFAULT_CONFIG: EventBufferConfig = {
  maxBatchSize: 20,
  flushIntervalMs: 2000,
};

// ---------------------------------------------------------------------------
// EventBuffer class
// ---------------------------------------------------------------------------

export class EventBuffer {
  private buffer: BufferedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private droppedCount = 0;
  private lifecycleHandlersRegistered = false;
  private readonly config: EventBufferConfig;

  constructor(config: Partial<EventBufferConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Buffer one event for later flush. Non-blocking, never throws.
   * Safe to call from any UI handler.
   */
  track(event: BufferedEvent): void {
    // Lazy lifecycle-handler registration so importing this module has no
    // side effects until something is actually tracked.
    if (!this.lifecycleHandlersRegistered) {
      this.registerLifecycleHandlers();
      this.lifecycleHandlersRegistered = true;
    }

    this.buffer.push(event);

    // Size trigger — flush immediately once we hit max.
    if (this.buffer.length >= this.config.maxBatchSize) {
      // Fire and forget. Callers of track() should not await a flush.
      void this.flush();
      return;
    }

    // Time trigger — arm a single timer on the FIRST event of a batch.
    // Subsequent events in the same window do NOT restart the timer
    // (otherwise a steady 1-per-500ms trickle would never flush).
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, this.config.flushIntervalMs);
    }
  }

  /**
   * Immediately flush whatever is in the buffer. Resolves once the insert
   * request settles (success or failure — failures are swallowed by design).
   */
  async flush(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length === 0) return;

    // Swap in a fresh buffer before the network call so events tracked
    // during the flush accumulate for the next batch, not this one.
    const batch = this.buffer;
    this.buffer = [];

    try {
      const { error } = await supabase.from('app_events').insert(
        batch.map((e) => ({
          user_id: e.user_id,
          event_type: e.event_type,
          payload: e.payload ?? null,
          source: e.source ?? 'mobile',
        })),
      );
      if (error) {
        this.droppedCount += batch.length;
        // Log once per failure — do NOT retry. Analytics are best-effort.
        // eslint-disable-next-line no-console
        console.warn('[eventBuffer] drop %d events: %s', batch.length, error.message);
      }
    } catch (err) {
      this.droppedCount += batch.length;
      // eslint-disable-next-line no-console
      console.warn('[eventBuffer] drop %d events (exception): %s', batch.length, String(err));
    }
  }

  /**
   * Number of events dropped to date (cumulative). Exposed for tests and
   * debug overlays — production code should not branch on this.
   */
  getDroppedCount(): number {
    return this.droppedCount;
  }

  /**
   * Number of events currently sitting in the buffer, unflushed.
   * Test-only helper.
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Reset internal state — test-only. Does NOT flush.
   */
  _resetForTests(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
    this.droppedCount = 0;
    this.lifecycleHandlersRegistered = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle: beforeunload (web) + AppState change (React Native)
  // -------------------------------------------------------------------------
  //
  // On web we use a synchronous-ish fire-and-forget flush from beforeunload.
  // The browser may or may not let the network request complete — that's
  // the cost of dropping the batch vs. retaining unbounded memory.
  //
  // On native we hook AppState. When the app backgrounds we flush so that
  // the batch isn't stuck in memory if the OS kills the process.

  private registerLifecycleHandlers(): void {
    // --- Web: beforeunload ---
    const w = globalThis as typeof globalThis & {
      addEventListener?: (type: string, handler: () => void) => void;
    };
    if (typeof w !== 'undefined' && typeof w.addEventListener === 'function') {
      try {
        w.addEventListener('beforeunload', () => {
          // Best-effort — no await possible.
          void this.flush();
        });
      } catch {
        // addEventListener may throw in exotic environments. Swallow.
      }
    }

    // --- React Native: AppState ---
    // Dynamically required so this module stays importable from web/node
    // test environments where react-native isn't resolvable.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const rn = require('react-native') as {
        AppState?: {
          addEventListener: (
            event: 'change',
            handler: (state: string) => void,
          ) => unknown;
        };
      };
      if (rn && rn.AppState && typeof rn.AppState.addEventListener === 'function') {
        rn.AppState.addEventListener('change', (state: string) => {
          if (state === 'background' || state === 'inactive') {
            void this.flush();
          }
        });
      }
    } catch {
      // react-native not available (web / node) — fine.
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

export const eventBuffer = new EventBuffer();
