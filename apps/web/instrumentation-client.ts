import * as Sentry from '@sentry/nextjs';

// Required by @sentry/nextjs — export even with tracing disabled to silence warning
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // No performance tracing or session replay — error capture only
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Ignore noise that isn't actionable
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    /^AbortError/,
    /^ChunkLoadError/,
  ],
});
