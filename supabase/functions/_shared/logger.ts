// deno-lint-ignore-file no-explicit-any
// Structured JSON logger for Supabase edge functions.
//
// Every log line is one JSON object on stdout/stderr. Supabase's log capture
// stores these as structured rows, which means operational queries in the
// dashboard (e.g. `level = 'error' and fn = 'ai-generate'`) replace grepping
// free-form strings.
//
// Shape of each line:
//   { ts, level, msg, request_id, fn, [user_id], [op], ...extra }
//
// Errors serialize to `{ name, message, stack }` — stack is suppressed in
// production (DENO_ENV=production) to keep log lines small. Sentry is the
// place to get stacks in prod; logs are for operational queries.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  request_id: string;
  fn: string;
  user_id?: string;
  op?: string;
  [key: string]: unknown;
}

export class Logger {
  constructor(private readonly ctx: LogContext) {}

  child(extra: Partial<LogContext>): Logger {
    return new Logger({ ...this.ctx, ...extra });
  }

  private emit(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
    const line = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...this.ctx,
      ...(extra ?? {}),
    };
    const serialized = JSON.stringify(line, errorReplacer);
    if (level === 'error' || level === 'warn') {
      console.error(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(msg: string, extra?: Record<string, unknown>) { this.emit('debug', msg, extra); }
  info(msg: string, extra?: Record<string, unknown>)  { this.emit('info',  msg, extra); }
  warn(msg: string, extra?: Record<string, unknown>)  { this.emit('warn',  msg, extra); }
  error(msg: string, extra?: Record<string, unknown>) { this.emit('error', msg, extra); }
}

// Serialize Error instances as structured objects. Without this, JSON.stringify
// turns an Error into `{}` (its enumerable own properties are empty).
function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: Deno.env.get('DENO_ENV') === 'production' ? undefined : value.stack,
    };
  }
  return value;
}

/**
 * Create a root logger for a request. Call this at the top of each handler,
 * passing the function name. A fresh request_id is generated per request.
 */
export function createRequestLogger(fn: string): Logger {
  return new Logger({
    request_id: crypto.randomUUID(),
    fn,
  });
}
