import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of server-side transactions for performance
  tracesSampleRate: 0.1,

  debug: false,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
