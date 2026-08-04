import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Who is using the app, and what they are allowed to reach.
 *
 * Three states, and the distinction between the last two matters:
 *
 *   signed-out   Only public pages. No fleet, no costs, no ledger.
 *   demo         Sample data, held in this browser only, clearly labelled as
 *                fake. Nothing is sent anywhere and nothing is shared.
 *   signed-in    A real account against a real company. Requires Supabase.
 *
 * Demo exists so a carrier can evaluate the thing without handing over an email
 * address first. It is deliberately not the default and is never silent — every
 * screen carries a banner, because a demo that looks like production is how
 * someone ends up making a dispatch decision on invented numbers.
 */

export type AuthMode = 'signed-out' | 'demo' | 'signed-in';

export type Session = {
  userId: string;
  email: string;
  companyId: string;
  companyName: string;
  role: 'owner' | 'driver';
};

const MODE_KEY = 'tripcost.authmode.v1';

/**
 * Supabase is configured only when both values are present. Until then, sign-in
 * is unavailable and the UI says so rather than presenting a login form that
 * cannot work.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const isBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

type AuthStore = {
  ready: boolean;
  mode: AuthMode;
  session: Session | null;
  /** True when the visitor may reach the fleet screens at all. */
  canAccessApp: boolean;
  backendConfigured: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthStore | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('signed-out');
  const [session] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Restore demo mode across reloads so someone mid-evaluation is not thrown
  // back to the landing page every refresh. A real session will be restored by
  // Supabase's own client once it is wired.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(MODE_KEY);
        if (!cancelled && saved === 'demo') setMode('demo');
      } catch {
        // A corrupt value just means starting signed out, which is the safe
        // direction to fail.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enterDemo = useCallback(() => {
    setMode('demo');
    AsyncStorage.setItem(MODE_KEY, 'demo').catch(() => {});
  }, []);

  const exitDemo = useCallback(() => {
    setMode('signed-out');
    AsyncStorage.removeItem(MODE_KEY).catch(() => {});
  }, []);

  const signOut = useCallback(() => {
    setMode('signed-out');
    AsyncStorage.removeItem(MODE_KEY).catch(() => {});
  }, []);

  const value = useMemo<AuthStore>(
    () => ({
      ready,
      mode,
      session,
      canAccessApp: mode === 'demo' || mode === 'signed-in',
      backendConfigured: isBackendConfigured,
      enterDemo,
      exitDemo,
      signOut,
    }),
    [ready, mode, session, enterDemo, exitDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthStore {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
