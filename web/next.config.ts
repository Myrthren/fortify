import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for Sentry server-side instrumentation in App Router
  experimental: { instrumentationHook: true },
  // Skip lint/type-check during prod build — we run these in CI separately.
  // Avoids spurious build failures on Netlify when CI environments differ.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organisation + project (set in env or here)
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps if SENTRY_AUTH_TOKEN is set
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry CLI output in build logs
  silent: true,

  // Disable source map upload if no auth token — avoids build failure
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Don't auto-instrument vercel cron routes (we use netlify)
  autoInstrumentServerFunctions: false,
});
