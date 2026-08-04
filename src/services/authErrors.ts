/**
 * Turns a Supabase or Postgres error into something a driver can act on.
 *
 * The raw messages are written for developers ("duplicate key value violates
 * unique constraint") and are worse than useless on a phone at a fuel desk: they
 * say nothing about what to do next, and they leak the shape of the database to
 * anyone probing it.
 *
 * Kept free of any React Native or Supabase import so it stays pure text
 * mapping — testable on its own, and no client is constructed to format an
 * error message.
 *
 * Unmapped messages pass through verbatim rather than being replaced with a
 * generic apology. Jargon a user can screenshot and send is more useful than
 * "something went wrong", which leaves them with nothing to report.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) {
    return 'That email and password do not match an account.';
  }
  if (m.includes('email not confirmed')) {
    return 'Check your email and click the confirmation link before signing in.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'An account with that email already exists. Try signing in instead.';
  }
  if (m.includes('password should be at least')) {
    return 'Password is too short. Use at least 8 characters.';
  }
  if (m.includes('already belongs to a company')) {
    return 'This account is already part of a carrier. Sign out first to join another.';
  }
  if (m.includes('invalid or expired invite')) {
    return 'That invite code is not valid, or it has run out. Ask your carrier for a new one.';
  }
  if (m.includes('only an owner can invite')) {
    return 'Only the carrier account can create invite codes.';
  }
  if (m.includes('not authenticated')) {
    return 'Your session ended. Sign in again.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Cannot reach the server. Check your connection.';
  }
  return message;
}
