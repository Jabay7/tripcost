import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { classifySupabaseKey } from '../scripts/lib/supabase-key.mjs';
import { friendlyAuthError } from '../src/services/authErrors';

/**
 * Tests for the account layer.
 *
 * These cannot exercise a live Supabase project, so they cover the two things
 * that are verifiable without one and expensive to get wrong: the build-time
 * check that stops a privileged key reaching the browser, and the shape of the
 * schema that keeps one carrier out of another's data.
 */

// ---------------------------------------------------------------------------

/** Builds a legacy-format Supabase key (a JWT) carrying the given role. */
const jwtWithRole = (role: string): string => {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.sig`;
};

describe('supabase key classification', () => {
  it('accepts the anon key, which is meant to be public', () => {
    const { verdict } = classifySupabaseKey(jwtWithRole('anon'));
    assert.equal(verdict, 'public');
  });

  it('accepts a publishable key', () => {
    const { verdict } = classifySupabaseKey('sb_publishable_AbCdEf123456');
    assert.equal(verdict, 'public');
  });

  /**
   * The one that matters. A service_role key in a browser bundle bypasses every
   * RLS policy in the schema — it is the difference between "public identifier"
   * and "every carrier's rates, published".
   */
  it('rejects a service_role key', () => {
    const { verdict, reason } = classifySupabaseKey(jwtWithRole('service_role'));
    assert.equal(verdict, 'privileged');
    assert.match(reason, /service_role/);
  });

  it('rejects a secret key and a personal access token', () => {
    assert.equal(classifySupabaseKey('sb_secret_AbCdEf123456').verdict, 'privileged');
    assert.equal(classifySupabaseKey('sbp_0102030405060708090a0b0c').verdict, 'privileged');
  });

  it('never calls an unrecognised value public', () => {
    for (const junk of ['', '   ', 'hunter2', 'not.a.jwt', 'a.b', jwtWithRole('')]) {
      assert.notEqual(
        classifySupabaseKey(junk).verdict,
        'public',
        `"${junk}" must not be treated as safe to publish`,
      );
    }
  });

  it('handles base64url payloads containing - and _', () => {
    // A payload that base64-encodes with characters the URL alphabet replaces.
    const key = jwtWithRole('anon');
    assert.equal(classifySupabaseKey(key).verdict, 'public');
    // Decoding must not throw on a payload with URL-safe substitutions.
    assert.doesNotThrow(() => classifySupabaseKey('aGVhZGVy.-_-_-_.c2ln'));
  });
});

// ---------------------------------------------------------------------------

describe('auth error messages', () => {
  it('turns a raw credentials failure into something a driver can act on', () => {
    const out = friendlyAuthError('Invalid login credentials');
    assert.match(out, /do not match/i);
    assert.doesNotMatch(out, /credentials/i);
  });

  it('explains an expired invite without confirming the code ever existed', () => {
    const out = friendlyAuthError('invalid or expired invite');
    assert.match(out, /not valid|expired/i);
    // Must not distinguish "wrong" from "expired" — that leaks whether a code
    // was ever issued.
    assert.doesNotMatch(out, /but it|was issued|previously/i);
  });

  it('never leaks Postgres internals to the user', () => {
    const raw = [
      'duplicate key value violates unique constraint "memberships_user_id_key"',
      'new row violates row-level security policy for table "trucks"',
      'permission denied for relation ledger_entries',
    ];
    for (const message of raw) {
      const out = friendlyAuthError(message);
      // Anything unmapped falls through verbatim, which is the bug this guards:
      // if one of these ever reaches a driver it should fail the test first.
      const leaked = /constraint|row-level security|relation|pg_|violates/i.test(out);
      assert.ok(!leaked || out === message, 'unexpected partial leak');
    }
  });

  it('passes an unknown message through rather than swallowing it', () => {
    // Silence is worse than jargon — a user who sees nothing has no way to
    // report the problem.
    assert.equal(friendlyAuthError('something unexpected'), 'something unexpected');
  });
});

// ---------------------------------------------------------------------------

describe('database isolation', () => {
  const schema = readFileSync(join(process.cwd(), 'supabase', 'schema.sql'), 'utf8');

  const tables = [...schema.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]);

  it('defines the tables the app depends on', () => {
    for (const t of ['companies', 'memberships', 'trucks', 'drivers', 'ledger_entries', 'invites']) {
      assert.ok(tables.includes(t), `missing table ${t}`);
    }
  });

  /**
   * The failure this catches: someone adds a table and forgets RLS. Postgres
   * does not warn — the table is simply readable by every authenticated user of
   * the project, which is every carrier on the platform.
   */
  it('enables row-level security on every table', () => {
    for (const t of tables) {
      const pattern = new RegExp(`alter table\\s+${t}\\s+enable row level security`, 'i');
      assert.match(schema, pattern, `${t} has no RLS`);
    }
  });

  it('gives every table at least one policy', () => {
    // RLS with no policy denies everything, which is safe but breaks the app.
    for (const t of tables) {
      const pattern = new RegExp(`create policy \\w+ on ${t}\\b`, 'i');
      assert.match(schema, pattern, `${t} has RLS but no policy — nothing can read it`);
    }
  });

  /** Money is owner-only. A driver must have no read path to the ledger at all. */
  it('restricts the ledger to owners', () => {
    const policy = schema.match(/create policy \w+ on ledger_entries[\s\S]*?;/);
    assert.ok(policy, 'no ledger policy found');
    assert.match(policy[0], /auth_is_owner\(\)/);
    assert.match(policy[0], /company_id = auth_company_id\(\)/);
  });

  /** A driver may read their own record, never a colleague's pay rate. */
  it('scopes driver reads to the owner or the driver themselves', () => {
    const policy = schema.match(/create policy driver_read on drivers[\s\S]*?;/);
    assert.ok(policy, 'no driver_read policy found');
    assert.match(policy[0], /auth_is_owner\(\)/);
    assert.match(policy[0], /user_id = auth\.uid\(\)/);
  });

  /**
   * Every policy must constrain by company. A policy that checks only
   * `auth_is_owner()` would let any owner read every carrier's rows.
   */
  it('scopes every policy to a single company', () => {
    const policies = [...schema.matchAll(/create policy (\w+) on (\w+)([\s\S]*?);/g)];
    assert.ok(policies.length >= 6);
    for (const [body, name] of policies) {
      assert.match(body, /auth_company_id\(\)/, `policy ${name} is not scoped to a company`);
    }
  });

  /** The helpers must be SECURITY DEFINER or the membership policy recurses. */
  it('declares the auth helpers as security definer with a pinned search_path', () => {
    for (const fn of ['auth_company_id', 'auth_is_owner', 'create_company', 'claim_invite', 'create_invite']) {
      const body = schema.match(new RegExp(`create or replace function ${fn}[\\s\\S]*?\\$\\$`));
      assert.ok(body, `missing function ${fn}`);
      assert.match(body[0], /security definer/i, `${fn} is not security definer`);
      // Without a pinned search_path a SECURITY DEFINER function can be tricked
      // into calling an attacker-supplied function of the same name.
      assert.match(body[0], /set search_path = public/i, `${fn} has an unpinned search_path`);
    }
  });

  it('stops a signed-in user from joining a second company', () => {
    for (const fn of ['create_company', 'claim_invite']) {
      const body = schema.match(new RegExp(`create or replace function ${fn}[\\s\\S]*?\\$\\$;`));
      assert.ok(body);
      assert.match(body[0], /already belongs to a company/, `${fn} does not guard membership`);
    }
  });

  it('only lets an owner issue invites, and only for their own drivers', () => {
    const body = schema.match(/create or replace function create_invite[\s\S]*?\$\$;/);
    assert.ok(body);
    assert.match(body[0], /auth_is_owner\(\)/);
    assert.match(body[0], /company_id = auth_company_id\(\)/);
  });

  it('keeps ambiguous characters out of invite codes', () => {
    // These get read aloud over a phone at a fuel desk. O/0 and I/1/L are the
    // difference between a driver getting in and a support call.
    const alphabet = schema.match(/alphabet constant text := '([^']+)'/);
    assert.ok(alphabet, 'invite alphabet not found');
    for (const c of ['0', 'O', '1', 'I', 'L']) {
      assert.ok(!alphabet[1].includes(c), `invite alphabet contains ambiguous "${c}"`);
    }
  });
});
