import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of sessions for performance tracing in production
  // (avoids quota burn — increase to 1.0 if you want full coverage)
  tracesSampleRate: 0.1,

  // Capture 10% of sessions for replays on errors
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  // Only capture errors — not console.log noise
  debug: false,

  // Don't send errors if SENTRY_DSN isn't set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
