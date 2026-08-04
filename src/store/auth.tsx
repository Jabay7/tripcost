import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  friendlyAuthError,
  isSupabaseConfigured,
  supabase,
  type MembershipRow,
} from '../services/supabase';

/**
 * Who is using the app, and what they are allowed to reach.
 *
 * Three states, and the distinction between the last two matters:
 *
 *   signed-out   Only public pages. No fleet, no costs, no ledger.
 *   demo         Sample data held in this browser only, clearly labelled fake.
 *   signed-in    A real account against a real company.
 *
 * Demo exists so a carrier can evaluate the app without handing over an email
 * first. It is never silent — every screen carries a banner — because a demo
 * that looks like production is how someone prices a real load off invented
 * numbers.
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
 * What signup intended, held until it can be carried out.
 *
 * Supabase enables email confirmation by default, so `signUp` often returns no
 * session — the account exists but nobody is signed in yet, and the RPC that
 * creates the company or claims the invite cannot run. Without this the carrier
 * confirms their email, signs in, has no membership, and is told to ask for an
 * invite: a dead end they cannot escape from inside the app.
 *
 * So the intent is parked here and replayed on the first sign-in that finds no
 * company. It holds no credentials — a company name or an invite code, nothing
 * more.
 */
const PENDING_KEY = 'tripcost.pendingsignup.v1';

type PendingSignup = { kind: 'carrier'; companyName: string } | { kind: 'driver'; code: string };

const savePending = (p: PendingSignup) =>
  AsyncStorage.setItem(PENDING_KEY, JSON.stringify(p)).catch(() => {});

const readPending = async (): Promise<PendingSignup | null> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSignup) : null;
  } catch {
    return null;
  }
};

const clearPending = () => AsyncStorage.removeItem(PENDING_KEY).catch(() => {});

export const isBackendConfigured = isSupabaseConfigured;

export type AuthResult = { ok: true } | { ok: false; error: string };

type AuthStore = {
  ready: boolean;
  mode: AuthMode;
  session: Session | null;
  /** True when the visitor may reach the fleet screens at all. */
  canAccessApp: boolean;
  /** True only for a real signed-in owner. Drivers and demo users are false. */
  isOwner: boolean;
  backendConfigured: boolean;
  busy: boolean;

  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUpCarrier: (email: string, password: string, companyName: string) => Promise<AuthResult>;
  signUpDriver: (email: string, password: string, inviteCode: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  exitDemo: () => void;
};

const AuthContext = createContext<AuthStore | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('signed-out');
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * Turns a Supabase auth user into an app session by looking up which company
   * they belong to. A user with no membership is authenticated but has nowhere
   * to go — that happens if signup half-completed — so they are signed out
   * rather than left in a broken half-state.
   */
  const hydrate = useCallback(async (userId: string, email: string): Promise<Session | null> => {
    const { data, error } = await supabase()
      .from('memberships')
      .select('company_id, role, companies(name)')
      .eq('user_id', userId)
      .maybeSingle<MembershipRow>();

    if (error || !data) return null;

    return {
      userId,
      email,
      companyId: data.company_id,
      companyName: data.companies?.name ?? 'My Carrier',
      role: data.role,
    };
  }, []);

  // Restore whatever state the visitor left in.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!isSupabaseConfigured) {
          const saved = await AsyncStorage.getItem(MODE_KEY);
          if (!cancelled && saved === 'demo') setMode('demo');
          return;
        }

        const { data } = await supabase().auth.getSession();
        const user = data.session?.user;

        if (user) {
          const s = await hydrate(user.id, user.email ?? '');
          if (!cancelled && s) {
            setSession(s);
            setMode('signed-in');
            return;
          }
          // Authenticated but no company — do not strand them in the app.
          if (!cancelled) await supabase().auth.signOut();
        }

        const saved = await AsyncStorage.getItem(MODE_KEY);
        if (!cancelled && saved === 'demo') setMode('demo');
      } catch {
        // Failing to restore should land on the public page, never inside the
        // app with a half-built session.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  // Keep the app in step with token refreshes and sign-outs from other tabs.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: sub } = supabase().auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_OUT' || !s?.user) {
        setSession(null);
        setMode((m) => (m === 'signed-in' ? 'signed-out' : m));
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const hydrated = await hydrate(s.user.id, s.user.email ?? '');
        if (hydrated) {
          setSession(hydrated);
          setMode('signed-in');
        }
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [hydrate]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setBusy(true);
      try {
        const { data, error } = await supabase().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { ok: false, error: friendlyAuthError(error.message) };
        if (!data.user) return { ok: false, error: 'Sign-in failed. Try again.' };

        let s = await hydrate(data.user.id, data.user.email ?? '');

        // No company yet. If this sign-in is the confirmation of a signup that
        // could not finish, finish it now.
        if (!s) {
          const pending = await readPending();
          if (pending) {
            const { error: rpcError } =
              pending.kind === 'carrier'
                ? await supabase().rpc('create_company', { company_name: pending.companyName })
                : await supabase().rpc('claim_invite', { invite_code: pending.code });

            if (rpcError) {
              await clearPending();
              await supabase().auth.signOut();
              return { ok: false, error: friendlyAuthError(rpcError.message) };
            }
            await clearPending();
            s = await hydrate(data.user.id, data.user.email ?? '');
          }
        }

        if (!s) {
          await supabase().auth.signOut();
          return {
            ok: false,
            error: 'This account is not linked to a carrier. Ask your carrier for an invite code.',
          };
        }
        setSession(s);
        setMode('signed-in');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: friendlyAuthError(e instanceof Error ? e.message : String(e)) };
      } finally {
        setBusy(false);
      }
    },
    [hydrate],
  );

  /**
   * Creates the auth user, then the company and owner membership in one
   * database call. `create_company` is transactional on the server, so a
   * failure cannot leave an orphaned company nobody can reach.
   */
  const signUpCarrier = useCallback(
    async (email: string, password: string, companyName: string): Promise<AuthResult> => {
      setBusy(true);
      try {
        const name = companyName.trim();
        await savePending({ kind: 'carrier', companyName: name });

        const { data, error } = await supabase().auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          await clearPending();
          return { ok: false, error: friendlyAuthError(error.message) };
        }

        // With email confirmation on there is no session yet, so the company
        // cannot be created here. It is created on first sign-in from the
        // pending record above.
        if (!data.session) {
          return {
            ok: false,
            error:
              'Account created. Check your email for a confirmation link, then sign in — ' +
              'your company is set up automatically.',
          };
        }

        const { error: rpcError } = await supabase().rpc('create_company', {
          company_name: name,
        });
        await clearPending();
        if (rpcError) return { ok: false, error: friendlyAuthError(rpcError.message) };

        const s = await hydrate(data.user!.id, data.user!.email ?? '');
        if (!s) return { ok: false, error: 'Company created but could not be loaded. Sign in again.' };

        setSession(s);
        setMode('signed-in');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: friendlyAuthError(e instanceof Error ? e.message : String(e)) };
      } finally {
        setBusy(false);
      }
    },
    [hydrate],
  );

  /** A driver joins an existing carrier by redeeming a single-use invite code. */
  const signUpDriver = useCallback(
    async (email: string, password: string, inviteCode: string): Promise<AuthResult> => {
      setBusy(true);
      try {
        const code = inviteCode.trim().toUpperCase();
        await savePending({ kind: 'driver', code });

        const { data, error } = await supabase().auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          await clearPending();
          return { ok: false, error: friendlyAuthError(error.message) };
        }

        if (!data.session) {
          return {
            ok: false,
            error:
              'Account created. Check your email for a confirmation link, then sign in — ' +
              'your invite code is applied automatically.',
          };
        }

        const { error: rpcError } = await supabase().rpc('claim_invite', {
          invite_code: code,
        });
        await clearPending();
        if (rpcError) return { ok: false, error: friendlyAuthError(rpcError.message) };

        const s = await hydrate(data.user!.id, data.user!.email ?? '');
        if (!s) return { ok: false, error: 'Joined, but the carrier could not be loaded. Sign in again.' };

        setSession(s);
        setMode('signed-in');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: friendlyAuthError(e instanceof Error ? e.message : String(e)) };
      } finally {
        setBusy(false);
      }
    },
    [hydrate],
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase().auth.signOut().catch(() => {});
    }
    setSession(null);
    setMode('signed-out');
    await AsyncStorage.removeItem(MODE_KEY).catch(() => {});
    // Anyone signing out was already in a company, so nothing is pending. Clear
    // it anyway: a stale record must never be applied to the next person who
    // signs in on a shared cab tablet.
    await clearPending();
  }, []);

  const enterDemo = useCallback(() => {
    setMode('demo');
    AsyncStorage.setItem(MODE_KEY, 'demo').catch(() => {});
  }, []);

  const exitDemo = useCallback(() => {
    setMode('signed-out');
    AsyncStorage.removeItem(MODE_KEY).catch(() => {});
  }, []);

  const value = useMemo<AuthStore>(
    () => ({
      ready,
      mode,
      session,
      canAccessApp: mode === 'demo' || mode === 'signed-in',
      isOwner: mode === 'signed-in' && session?.role === 'owner',
      backendConfigured: isSupabaseConfigured,
      busy,
      signIn,
      signUpCarrier,
      signUpDriver,
      signOut,
      enterDemo,
      exitDemo,
    }),
    [ready, mode, session, busy, signIn, signUpCarrier, signUpDriver, signOut, enterDemo, exitDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthStore {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
