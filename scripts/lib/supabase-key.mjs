/**
 * Classifies a Supabase API key before it is allowed into a public bundle.
 *
 * Two keys sit next to each other on the same Supabase settings page and look
 * broadly alike:
 *
 *   anon / publishable   a public identifier. Safe in a browser bundle — every
 *                        request it makes is still subject to Row-Level
 *                        Security, so it grants no data access on its own.
 *   service_role / secret  bypasses RLS entirely. Publishing one hands every
 *                        carrier's rates, margins and driver records to anyone
 *                        who opens devtools.
 *
 * Confusing them is a single copy-paste away and produces no visible symptom —
 * the app works perfectly either way. So this is checked at build time and the
 * build is failed, rather than trusting anyone to notice.
 *
 * Returns { verdict, reason } where verdict is:
 *   'public'     safe to publish
 *   'privileged' must never be published
 *   'unknown'    unrecognised format — treated as suspicious, not as safe
 */
export function classifySupabaseKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';

  if (!key) return { verdict: 'unknown', reason: 'empty' };

  // Newer prefixed formats say what they are on the tin.
  if (key.startsWith('sb_publishable_')) {
    return { verdict: 'public', reason: 'publishable key' };
  }
  if (key.startsWith('sb_secret_')) {
    return { verdict: 'privileged', reason: 'secret key' };
  }
  // Personal access token — not a project key at all, and highly privileged.
  if (key.startsWith('sbp_')) {
    return { verdict: 'privileged', reason: 'personal access token' };
  }

  // Legacy format: a JWT whose payload carries the role.
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      // base64url, which Buffer's 'base64' decoder handles once - and _ are
      // mapped back. Padding is optional for Buffer.
      const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf8',
      );
      const role = JSON.parse(json).role;
      if (role === 'anon') return { verdict: 'public', reason: 'anon key' };
      if (typeof role === 'string') {
        return { verdict: 'privileged', reason: `role "${role}"` };
      }
      return { verdict: 'unknown', reason: 'JWT carries no role claim' };
    } catch {
      return { verdict: 'unknown', reason: 'JWT payload could not be decoded' };
    }
  }

  return { verdict: 'unknown', reason: 'unrecognised key format' };
}
