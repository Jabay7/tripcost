import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

/**
 * The Supabase client, and the only place credentials are read.
 *
 * The anon key is safe in the app bundle — that is what it is for. It grants no
 * data access on its own; every table has Row-Level Security and a request
 * carrying only the anon key sees nothing. What protects a carrier's fleet is
 * the policies in `supabase/schema.sql`, not the secrecy of this string. The
 * service-role key is the one that must never appear here, and does not.
 *
 * The client is created lazily so an unconfigured build does not crash at
 * import time — the landing page needs to render and say "accounts are not
 * connected" rather than white-screen.
 */

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(URL && ANON_KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.',
    );
  }
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: {
        // AsyncStorage rather than the web default, so a session survives an
        // app restart on a phone as well as a browser refresh.
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // React Native has no URL bar to parse a magic-link fragment from.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Shapes returned by the database. Kept narrow — only what the app reads.
// ---------------------------------------------------------------------------

export type MembershipRow = {
  company_id: string;
  role: 'owner' | 'driver';
  companies: { name: string } | null;
};

// Error copy lives in its own module so it can be tested without constructing a
// client — importing this file pulls in React Native, which a test runner cannot
// transform.
export { friendlyAuthError } from './authErrors';
