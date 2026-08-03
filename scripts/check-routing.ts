/**
 * Does live truck routing actually work, and how different is it?
 *
 * Run with `npm run check:routing` (needs ORS_KEY in .env). Prints the offline
 * estimate and the real truck route side by side for a few real lanes, so you
 * can see how far off the straight-line guess was.
 */
import { DEFAULT_PROFILE } from '../src/data/defaults';
import { cityById } from '../src/data/geo';
import { defaultOptionalCosts } from '../src/data/optionalCosts';
import { MockRouting, OpenRouteService } from '../src/services/routing';
import type { TripInput } from '../src/types';

const KEY = process.env.ORS_KEY ?? process.env.EXPO_PUBLIC_ORS_KEY;

const LANES: [string, string][] = [
  ['dal', 'chi'],
  ['lar', 'sea'],
  ['den', 'slc'],
];

function trip(from: string, to: string): TripInput {
  return {
    origin: cityById(from)!,
    destination: cityById(to)!,
    stops: [],
    deadheadMiles: 0,
    departAt: new Date().toISOString(),
    equipment: 'dry-van',
    grossWeightLbs: 78000,
    rate: 2.6,
    rateMode: 'per-mile',
    hazmat: null,
    reeferSetPointF: null,
    oversize: false,
    optionalCosts: defaultOptionalCosts(),
    deliverBy: null,
  };
}

async function main() {
  if (!KEY) {
    console.error('\nNo ORS_KEY. Add it to .env:\n  ORS_KEY=<your openrouteservice token>\n');
    process.exit(1);
  }

  const offline = new MockRouting();
  const live = new OpenRouteService('https://api.openrouteservice.org', KEY);

  console.log('\nStraight-line estimate vs real truck route\n');

  for (const [from, to] of LANES) {
    const t = trip(from, to);
    const label = `${t.origin.name} → ${t.destination.name}`;
    const est = await offline.route(t);

    let real;
    const t0 = Date.now();
    try {
      real = await live.route(t);
    } catch (e) {
      console.log(`── ${label}\n   estimate ${Math.round(est.totalMiles)} mi`);
      console.log(`   LIVE FAILED: ${e instanceof Error ? e.message : e}\n`);
      continue;
    }
    const ms = Date.now() - t0;

    const diff = real.totalMiles - est.totalMiles;
    const pct = (diff / est.totalMiles) * 100;

    console.log(`── ${label}   (${ms} ms)`);
    console.log(`   estimate   ${Math.round(est.totalMiles).toLocaleString().padStart(6)} mi   ${est.states.join(' ')}`);
    console.log(`   real       ${Math.round(real.totalMiles).toLocaleString().padStart(6)} mi   ${real.states.join(' ')}`);
    console.log(
      `   difference ${diff >= 0 ? '+' : ''}${Math.round(diff).toLocaleString().padStart(5)} mi   (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`,
    );
    console.log(`   drive time ${real.driveHours.toFixed(1)} hr · truck-legal: ${real.truckLegal}\n`);
  }

  // Fuel cost moves with mileage, so this is what the error was worth.
  const t = trip('dal', 'chi');
  const est = await offline.route(t);
  const real = await live.route(t);
  const gap = Math.abs(real.totalMiles - est.totalMiles);
  const fuel = (gap / DEFAULT_PROFILE.mpg) * 3.78;
  console.log(
    `On Dallas → Chicago alone the estimate was off by ${Math.round(gap)} mi — about $${fuel.toFixed(0)} of diesel unaccounted for.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
