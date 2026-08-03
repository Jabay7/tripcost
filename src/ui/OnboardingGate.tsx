import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ONBOARDING_VERSION, useStore } from '../store/store';

/**
 * Sends a genuinely first-time user to the welcome screen, once.
 *
 * Three things this has to get right, and each of them is a bug if missed:
 *
 *  - **Wait for storage.** The persisted flag loads asynchronously. Redirecting
 *    before `ready` would flash the walkthrough at every returning user on
 *    every cold start.
 *  - **Do not fight the user.** Once they are on welcome or walkthrough, stop
 *    redirecting, or Back becomes a loop they cannot escape.
 *  - **Redirect once.** `router.replace` rather than `push`, so the tour never
 *    ends up underneath the app in the history stack.
 */
export function OnboardingGate() {
  const { ready, onboardingVersion } = useStore();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    if (onboardingVersion >= ONBOARDING_VERSION) return;

    const first = segments[0];
    if (first === 'welcome' || first === 'walkthrough') return;

    router.replace('/welcome');
  }, [ready, onboardingVersion, segments]);

  return null;
}
