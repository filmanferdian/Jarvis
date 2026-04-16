import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-init to avoid crashing at build time when env vars aren't available.
// Next.js "Collecting page data" phase executes route modules during build,
// so we must not call createClient() until an actual request hits at runtime.
//
// M4: This module uses SUPABASE_SERVICE_ROLE_KEY and MUST NEVER be imported from
// a client component. If `typeof window !== 'undefined'` when getSupabase() is
// called, we throw — this catches accidental imports (bundling would expose the
// service-role key to the browser). Server routes are unaffected.
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[security] @/lib/supabase uses the service-role key and must not be imported from client components. ' +
        'Call it from API routes (src/app/api/**) or server-only modules (src/lib/**) instead.',
    );
  }
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Proxy defers all property access to the lazily-created client.
// During build, if the proxy is accessed but env vars are missing, we return
// a chainable stub so that module evaluation doesn't throw.
const isBuild = !process.env.NEXT_PUBLIC_SUPABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildStub: any = new Proxy(() => buildStub, {
  get: () => buildStub,
  apply: () => buildStub,
});

export const supabase: SupabaseClient = isBuild
  ? buildStub
  : new Proxy({} as SupabaseClient, {
      get(_target, prop: string) {
        const client = getSupabase();
        const value = (client as never as Record<string, unknown>)[prop];
        return typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown).bind(client)
          : value;
      },
    });
