import { friendlyAuthError, supabase } from './supabase';

/**
 * Driver invites.
 *
 * A carrier cannot add a driver's login for them — they do not know the
 * driver's auth user id, and asking a carrier to handle a driver's password
 * would be wrong on every axis. So the carrier issues a code, the driver
 * redeems it when they sign up, and the join happens on the driver's side.
 *
 * Codes are single-use and expire in 14 days (see supabase/schema.sql), so a
 * code left in a group text does not become a permanent door into the fleet.
 */

export type InviteResult = { ok: true; code: string } | { ok: false; error: string };

/** Issues a code for a driver to join this carrier. Owner only, enforced in Postgres. */
export async function createInvite(driverId?: string): Promise<InviteResult> {
  try {
    const { data, error } = await supabase().rpc('create_invite', {
      for_driver_id: driverId ?? null,
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    if (typeof data !== 'string') return { ok: false, error: 'No code returned. Try again.' };
    return { ok: true, code: data };
  } catch (e) {
    return { ok: false, error: friendlyAuthError(e instanceof Error ? e.message : String(e)) };
  }
}

export type OpenInvite = {
  id: string;
  code: string;
  expiresAt: string;
  driverId: string | null;
};

/** Codes that have been issued but not yet redeemed, so an owner can re-send one. */
export async function listOpenInvites(): Promise<OpenInvite[]> {
  try {
    const { data, error } = await supabase()
      .from('invites')
      .select('id, code, expires_at, driver_id')
      .is('claimed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      expiresAt: r.expires_at as string,
      driverId: (r.driver_id as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}
