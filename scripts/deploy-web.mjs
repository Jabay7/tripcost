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
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.env.DEPLOY_REPO ?? 'Jabay7/tripcost';
const BASE = process.env.EXPO_DEPLOY_BASE_URL ?? `/${REPO.split('/')[1]}`;
const dist = join(process.cwd(), 'dist');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });

console.log(`\nBuilding web bundle with baseUrl=${BASE}\n`);
rmSync(dist, { recursive: true, force: true });
run('npx', ['expo', 'export', '--platform', 'web'], {
  env: { ...process.env, EXPO_DEPLOY_BASE_URL: BASE },
});

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Export produced no index.html — aborting.');
  process.exit(1);
}

// Jekyll would drop _expo/ entirely without this.
writeFileSync(join(dist, '.nojekyll'), '');

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
console.log(`\nLive at https://${owner.toLowerCase()}.github.io/${name}/\n`);
