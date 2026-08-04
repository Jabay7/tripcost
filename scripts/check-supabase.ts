/**
 * Proves the account layer is wired and, more importantly, that it is closed.
 *
 *   npm run check:supabase
 *
 * The interesting assertion is not "can we reach the database" — it is "does an
 * unauthenticated client, holding the same publishable key that ships in the
 * browser bundle, see nothing?" If any of these tables returns a row, the
 * tenancy model is broken and no amount of careful client code fixes it.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!URL || !KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const pad = (s: string, n: number) => s.padEnd(n);
const ok = (b: boolean) => (b ? 'PASS' : 'FAIL');

let failures = 0;
const check = (name: string, passed: boolean, detail = '') => {
  if (!passed) failures++;
  console.log(`  ${ok(passed)}  ${pad(name, 46)}${detail}`);
};

const client = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`\nProject: ${URL}`);
  console.log(`Key:     ${KEY.slice(0, 18)}…  (publishable / anon — safe in a bundle)\n`);

  console.log('Reachability');
  {
    const { error } = await client.from('companies').select('id').limit(1);
    // A reachable project with RLS returns no rows and no error. A missing table
    // or a bad key returns an error, which is the case worth distinguishing.
    check('project responds', !error || !/fetch|network/i.test(error.message), error?.message ?? '');
  }

  console.log('\nRow-Level Security — an anonymous client must see nothing');
  for (const table of ['companies', 'memberships', 'trucks', 'drivers', 'ledger_entries', 'invites']) {
    const { data, error } = await client.from(table).select('*').limit(5);
    const rows = data?.length ?? 0;
    // Either an explicit denial or an empty result is correct. Rows are not.
    check(`${table} leaks no rows`, rows === 0, error ? `(${error.code ?? 'denied'})` : `${rows} rows`);
  }

  console.log('\nPrivileged functions must refuse an anonymous caller');
  {
    const { error } = await client.rpc('create_company', { company_name: 'Should Not Exist' });
    check('create_company rejects anon', Boolean(error), error?.message ?? 'NO ERROR — company created!');
  }
  {
    const { error } = await client.rpc('create_invite', { for_driver_id: null });
    check('create_invite rejects anon', Boolean(error), error?.message ?? 'NO ERROR — invite issued!');
  }
  {
    const { error } = await client.rpc('claim_invite', { invite_code: 'ZZZZ-9999' });
    check('claim_invite rejects a bogus code', Boolean(error), error?.message ?? 'NO ERROR');
  }

  console.log('\nAuth service');
  {
    // Reaching the settings endpoint proves the URL and key are right.
    // Deliberately not completing a signup — this script creates no accounts.
    const res = await fetch(`${URL}/auth/v1/settings`, { headers: { apikey: KEY } });
    const settings = res.ok ? ((await res.json()) as Record<string, unknown>) : null;
    check('auth service reachable', res.ok, res.ok ? '' : `HTTP ${res.status}`);
    if (settings) {
      const confirmOn = settings.mailer_autoconfirm === false;
      console.log(
        `\n  Email confirmation is ${confirmOn ? 'ON' : 'OFF'} — ` +
          (confirmOn
            ? 'signup parks the company name and applies it on first sign-in.'
            : 'signup completes immediately.'),
      );
    }
  }

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
