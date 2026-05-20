/**
 * Structured logger for JD Suite.
 *
 * In production: writes JSON to stdout (Vercel log drain picks it up) and
 * forwards to Sentry via captureException / captureMessage.
 *
 * In development: pretty-prints to console, no Sentry calls.
 *
 * Usage:
 *   logger.error('db.cold-start', err, { userId });
 *   logger.warn('api.retry', 'Honest review retry attempt 2', { jdId });
 *   logger.info('jd.created', { jdId });
 */

type LogLevel = 'info' | 'warn' | 'error';

type Meta = Record<string, unknown>;

function log(level: LogLevel, event: string, detail?: unknown, meta?: Meta) {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const entry = {
      level,
      event,
      ...(meta ?? {}),
      ts: new Date().toISOString(),
      ...(detail instanceof Error
        ? { message: detail.message, stack: detail.stack }
        : typeof detail === 'string'
        ? { message: detail }
        : detail != null
        ? { detail }
        : {}),
    };
    // Vercel captures stdout as structured logs when the value is valid JSON
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const prefix = `[${level.toUpperCase()}] ${event}`;
    if (detail instanceof Error) {
      console[level](prefix, detail, meta ?? '');
    } else {
      console[level](prefix, detail ?? '', meta ?? '');
    }
  }

  // Forward errors and warnings to Sentry (server-side only; client uses automatic capture)
  if (typeof window === 'undefined' && (level === 'error' || level === 'warn')) {
    // Dynamic import avoids bundling Sentry into paths that don't need it
    import('@sentry/nextjs').then(({ captureException, captureMessage, withScope }) => {
      if (detail instanceof Error) {
        withScope((scope) => {
          scope.setLevel(level);
          scope.setContext('meta', { event, ...(meta ?? {}) });
          captureException(detail);
        });
      } else {
        captureMessage(
          `${event}${typeof detail === 'string' ? ': ' + detail : ''}`,
          { level, extra: { event, detail, ...(meta ?? {}) } },
        );
      }
    }).catch(() => { /* Sentry unavailable — don't crash */ });
  }
}

export const logger = {
  info:  (event: string, meta?: Meta) => log('info', event, undefined, meta),
  warn:  (event: string, detail?: unknown, meta?: Meta) => log('warn', event, detail, meta),
  error: (event: string, detail?: unknown, meta?: Meta) => log('error', event, detail, meta),
};
