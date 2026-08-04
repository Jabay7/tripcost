import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../store/auth';

/** Routes reachable without an account. Everything else is behind the gate. */
const PUBLIC_ROUTES = new Set(['welcome', 'login', 'signup', 'walkthrough']);

/**
 * Keeps the fleet screens behind an account.
 *
 * The old build dropped a visitor straight into a fleet console. Nothing leaked
 * — the data was seeded locally in each browser and never left the device — but
 * the shape was wrong: a management interface should not be the first thing a
 * stranger sees at a URL.
 *
 * Three things this has to get right, and each is a bug if missed:
 *
 *  - **Wait for storage.** Demo mode is restored asynchronously. Redirecting
 *    before `ready` bounces someone mid-evaluation back to the landing page on
 *    every refresh.
 *  - **Do not fight the user.** Once on a public route, stop redirecting, or
 *    Back becomes a loop.
 *  - **Push signed-in users off the landing page.** Otherwise signing in leaves
 *    them looking at a marketing page with no obvious way forward.
 */
export function AuthGate() {
  const { ready, canAccessApp } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;

    const first = segments[0] ?? '';
    const onPublicRoute = PUBLIC_ROUTES.has(first);

    if (!canAccessApp && !onPublicRoute) {
      router.replace('/welcome');
      return;
    }

    // Someone with access sitting on the landing page belongs in the app.
    if (canAccessApp && (first === 'welcome' || first === 'login' || first === 'signup')) {
      router.replace('/(tabs)');
    }
  }, [ready, canAccessApp, segments]);

  return null;
}
