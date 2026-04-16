// Runtime environment validation.
// Imported by any server-side module to assert required secrets before use.
// Stays lazy / idempotent so build-time page data collection doesn't crash.

let validated = false;

export function assertServerEnv(): void {
  if (validated) return;

  const errors: string[] = [];

  // CRON_SECRET must be at least 32 chars (L1)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cronSecret.length > 0 && cronSecret.length < 32) {
    errors.push(`CRON_SECRET too short (${cronSecret.length} chars); need >= 32`);
  }

  // JARVIS_AUTH_TOKEN must be at least 32 chars
  const authToken = process.env.JARVIS_AUTH_TOKEN;
  if (authToken && authToken.length > 0 && authToken.length < 32) {
    errors.push(`JARVIS_AUTH_TOKEN too short (${authToken.length} chars); need >= 32`);
  }

  // In production, NEXT_PUBLIC_APP_URL must be set (OAuth callbacks depend on it)
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_APP_URL) {
    errors.push('NEXT_PUBLIC_APP_URL required in production');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  validated = true;
}
