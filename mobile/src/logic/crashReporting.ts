/**
 * Optional Sentry boot. No-op without EXPO_PUBLIC_SENTRY_DSN or linked SDK.
 */

export async function initCrashReporting(): Promise<void> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    // Optional dependency — install @sentry/react-native when enabling crash reporting.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as {
      init: (opts: { dsn: string; enableAutoSessionTracking?: boolean }) => void;
    };
    Sentry.init({ dsn, enableAutoSessionTracking: true });
  } catch {
    if (__DEV__) {
      console.warn('[sentry] @sentry/react-native not linked; crash reporting skipped.');
    }
  }
}
