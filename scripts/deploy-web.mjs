/**
 * Builds the web bundle and publishes it to the gh-pages branch.
 *
 *   npm run deploy:web
 *
 * Two things this handles that a plain `expo export` does not:
 *
 *  - **Base path.** GitHub Pages serves a project site from /<repo>, so the
 *    bundle is exported with EXPO_DEPLOY_BASE_URL set. Without it every asset
 *    request resolves against / and 404s.
 *
 *  - **.nojekyll.** Pages runs Jekyll by default, and Jekyll silently skips
 *    directories beginning with an underscore. Expo puts the entire bundle in
 *    `_expo/`, so without this file the site loads a blank page with no error
 *    that points at the cause.
 *
 * Publishing uses a throwaway repository inside dist/ rather than a subtree
 * merge, so the deploy branch stays a flat snapshot and never entangles the
 * source history.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifySupabaseKey } from './lib/supabase-key.mjs';

const REPO = process.env.DEPLOY_REPO ?? 'Jabay7/tripcost';

/**
 * A custom domain serves from the root, a github.io project site serves from
 * /<repo>. Getting this wrong is the classic Pages failure: every asset 404s
 * and the page renders blank with nothing in the console pointing at the cause.
 *
 *   DEPLOY_DOMAIN=tripcost.app npm run deploy:web
 */
const DOMAIN = process.env.DEPLOY_DOMAIN ?? '';
const BASE = process.env.EXPO_DEPLOY_BASE_URL ?? (DOMAIN ? '/' : `/${REPO.split('/')[1]}`);
const dist = join(process.cwd(), 'dist');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });

console.log(`\nBuilding web bundle with baseUrl=${BASE}\n`);
rmSync(dist, { recursive: true, force: true });

/**
 * Expo auto-loads .env and inlines every EXPO_PUBLIC_* value into the bundle.
 * On a public site that is a published secret: anyone can read the JS and burn
 * the quota. Strip them for the web deploy — the app falls back to the offline
 * estimate and labels itself OFFLINE, which is honest and costs nothing.
 *
 * Device builds are different: EAS injects keys per profile (see eas.json), and
 * an app binary is meaningfully harder to mine than a URL. Set
 * DEPLOY_ALLOW_PUBLIC_KEYS=1 to override, but understand what you are shipping.
 */
/**
 * The one class of credential that belongs in a public bundle.
 *
 * The Supabase anon key is a public identifier, not a secret — it is how an
 * unauthenticated browser addresses the project at all. What protects the data
 * is Row-Level Security (supabase/schema.sql); a request carrying only this key
 * can read nothing. Stripping it does not harden anything, it just breaks
 * sign-in.
 *
 * The service-role key is the opposite and would be catastrophic here: it
 * bypasses RLS entirely. `assertNotPrivileged` below refuses to build if one is
 * pasted into this variable by mistake, which is an easy mistake to make —
 * they sit next to each other on the same settings page.
 */
const PUBLIC_BY_DESIGN = new Set(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);

/** Parses .env off disk. npm does not load it, and EXPO_NO_DOTENV stops Expo doing so. */
const readEnvFile = () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  // Strip a UTF-8 BOM: it becomes part of the first variable's name otherwise.
  for (const line of readFileSync(envPath, 'utf8').replace(/^﻿/, '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
};

/** Refuses to build if the "anon" key is anything that bypasses RLS. */
const assertNotPrivileged = (value) => {
  const { verdict, reason } = classifySupabaseKey(value);
  if (verdict === 'public') return;
  if (verdict === 'privileged') {
    console.error(`\nREFUSING TO BUILD — EXPO_PUBLIC_SUPABASE_ANON_KEY is a ${reason}.`);
    console.error('That key bypasses every Row-Level Security policy. Use the anon key instead.\n');
    process.exit(1);
  }
  console.warn(`Warning: Supabase key not recognised (${reason}). Verify it is the anon key.\n`);
};

const buildEnv = { ...process.env, EXPO_DEPLOY_BASE_URL: BASE };
if (!process.env.DEPLOY_ALLOW_PUBLIC_KEYS) {
  // Deleting the variables from process.env is NOT enough — Expo reads .env
  // off disk itself, so a stripped environment still ships the key. Only
  // EXPO_NO_DOTENV stops the file being read at all.
  buildEnv.EXPO_NO_DOTENV = '1';
  for (const k of Object.keys(buildEnv)) {
    if (k.startsWith('EXPO_PUBLIC_') && /KEY|TOKEN|SECRET/i.test(k)) delete buildEnv[k];
  }

  // .env is off, so the public-by-design values have to be put back explicitly.
  const fileEnv = readEnvFile();
  const restored = [];
  for (const name of PUBLIC_BY_DESIGN) {
    const value = process.env[name] ?? fileEnv[name];
    if (!value) continue;
    if (name.endsWith('ANON_KEY')) assertNotPrivileged(value);
    buildEnv[name] = value;
    restored.push(name);
  }

  console.log('Public bundle: .env disabled, EXPO_PUBLIC_*KEY stripped.');
  console.log(
    restored.length
      ? `Kept (public by design, protected by RLS): ${restored.join(', ')}\n`
      : 'No Supabase config found — the site will show "accounts not connected".\n',
  );
}

// --clear is load-bearing, not hygiene. Metro inlines EXPO_PUBLIC_* values at
// transform time and caches the result, so a build that once embedded a key
// keeps serving it from cache even after the key is removed from the
// environment. Without this the secret scan below passes and the bundle still
// ships the key.
run('npx', ['expo', 'export', '--platform', 'web', '--clear'], { env: buildEnv });

/**
 * Trust, then verify. The stripping above is easy to defeat with one careless
 * change, and the failure is silent — a published key looks exactly like a
 * working deploy. So grep the built bundle for anything key-shaped and refuse
 * to publish if it is there.
 */
if (!process.env.DEPLOY_ALLOW_PUBLIC_KEYS) {
  // Read .env off disk rather than trusting process.env — npm does not load it,
  // so a scanner that only looks at the environment finds nothing to look for
  // and reports a false clean. The file is the thing that leaks.
  //
  // PUBLIC_BY_DESIGN values are excluded because they were deliberately kept
  // above; an allowlist that is not honoured here would fail every deploy.
  const suspects = [];
  const consider = (name, value) => {
    if (PUBLIC_BY_DESIGN.has(name)) return;
    if (typeof value !== 'string' || value.length < 16) return;
    suspects.push([name, value]);
  };
  for (const [k, v] of Object.entries(process.env)) {
    if (/KEY|TOKEN|SECRET/i.test(k)) consider(k, v);
  }
  for (const [k, v] of Object.entries(readEnvFile())) consider(k, v);
  if (suspects.length === 0) {
    console.warn('Secret scan: nothing to check for — no keys found in env or .env.');
  }

  const bundleDir = join(dist, '_expo', 'static', 'js', 'web');
  const files = existsSync(bundleDir) ? readdirSync(bundleDir) : [];
  const leaks = [];

  for (const file of files) {
    const text = readFileSync(join(bundleDir, file), 'utf8');
    for (const [name, value] of suspects) {
      if (text.includes(value)) leaks.push(`${name} in ${file}`);
    }
  }

  if (leaks.length) {
    console.error('\nREFUSING TO PUBLISH — secrets found in the bundle:');
    for (const l of leaks) console.error(`  ${l}`);
    console.error('\nRotate the exposed key, then fix the build before deploying.\n');
    process.exit(1);
  }
  console.log('Secret scan: clean.\n');
}

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Export produced no index.html — aborting.');
  process.exit(1);
}

// Jekyll would drop _expo/ entirely without this.
writeFileSync(join(dist, '.nojekyll'), '');

// GitHub Pages reads the custom domain from a CNAME file in the published
// branch. It must be rewritten on every deploy — the branch is replaced
// wholesale, so a CNAME set once in the repo settings is wiped by the next
// push and the domain silently reverts to github.io.
if (DOMAIN) {
  writeFileSync(join(dist, 'CNAME'), `${DOMAIN}\n`);
  console.log(`Custom domain: ${DOMAIN}`);
}

// Pages has no SPA rewrite, but Expo's static export writes a real .html for
// every route, so deep links work. 404.html covers anything unrouted.
writeFileSync(
  join(dist, '404.html'),
  '<!doctype html><meta charset="utf-8"><title>Not found</title>' +
    `<meta http-equiv="refresh" content="0; url=${BASE}/">`,
);

console.log('\nPublishing to gh-pages\n');
rmSync(join(dist, '.git'), { recursive: true, force: true });

// shell:false so arguments containing spaces survive intact — passing
// `user.name=TripCost Deploy` through a shell splits it into two arguments and
// git fails with an unhelpful error.
const git = (...args) =>
  execFileSync('git', args, { stdio: 'inherit', cwd: dist, shell: false });

git('init', '-b', 'gh-pages');
git('config', 'user.name', 'TripCost Deploy');
git('config', 'user.email', 'deploy@local');
git('add', '-A');
git('commit', '-q', '-m', 'Deploy web build');
git('remote', 'add', 'origin', `https://github.com/${REPO}.git`);
git('push', '-f', 'origin', 'gh-pages');

// Leave no stray repository behind inside the build output.
rmSync(join(dist, '.git'), { recursive: true, force: true });

const [owner, name] = REPO.split('/');
console.log(
  `\nLive at ${DOMAIN ? `https://${DOMAIN}/` : `https://${owner.toLowerCase()}.github.io/${name}/`}\n`,
);
if (DOMAIN) {
  console.log('If this is the first deploy on that domain, DNS can take up to an hour,');
  console.log("and GitHub's HTTPS certificate is issued a few minutes after DNS resolves.\n");
}
