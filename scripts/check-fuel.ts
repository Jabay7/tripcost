/**
 * Is the EIA feed reachable, and how stale was the snapshot?
 *
 * Run with `npm run check:fuel` (needs EIA_KEY in .env). Prints the offline
 * snapshot against live weekly prices for a real lane, so you can see how far
 * the built-in numbers have drifted.
 */
import { cityById } from '../src/data/geo';
import { defaultOptionalCosts } from '../src/data/optionalCosts';
import { EiaFuel, MockFuel } from '../src/services/fuel';
import { MockRouting } from '../src/services/routing';
import type { TripInput } from '../src/types';

const KEY = process.env.EIA_KEY ?? process.env.EXPO_PUBLIC_EIA_KEY;

const trip: TripInput = {
  origin: cityById('hou')!,
  destination: cityById('chi')!,
  stops: [],
  deadheadMiles: 0,
  departAt: new Date().toISOString(),
  equipment: 'dry-van',
  grossWeightLbs: 62000,
  rate: 2.6,
  rateMode: 'per-mile',
  hazmat: null,
  reeferSetPointF: null,
  oversize: false,
  optionalCosts: defaultOptionalCosts(),
  deliverBy: null,
};

async function main() {
  if (!KEY) {
    console.error('\nNo EIA_KEY. Add it to .env:\n  EIA_KEY=<your eia key>\n');
    process.exit(1);
  }

  const route = await new MockRouting().route(trip);
  const snapshot = await new MockFuel().prices(route);

  const t0 = Date.now();
  const live = await new EiaFuel(KEY).prices(route);
  const ms = Date.now() - t0;

  console.log(`\n${trip.origin.name} → ${trip.destination.name}   (${ms} ms)\n`);
  console.log(`  provider: ${live.provider}`);
  console.log(`  as of:    ${live.asOf}\n`);

  console.log('  state    snapshot      live      drift');
  console.log('  ' + '-'.repeat(42));
  for (const q of live.byState) {
    const old = snapshot.byState.find((s) => s.state === q.state);
    const drift = old ? q.pricePerGal - old.pricePerGal : 0;
    console.log(
      `  ${q.state.padEnd(6)} ${(old ? '$' + old.pricePerGal.toFixed(3) : '—').padStart(9)}` +
        ` ${('$' + q.pricePerGal.toFixed(3)).padStart(9)}` +
        `  ${(drift >= 0 ? '+' : '') + drift.toFixed(3)}`,
    );
  }

  const blendDrift = live.blendedPricePerGal - snapshot.blendedPricePerGal;
  console.log(
    `\n  blended  $${snapshot.blendedPricePerGal.toFixed(3)} → $${live.blendedPricePerGal.toFixed(3)}` +
      `  (${blendDrift >= 0 ? '+' : ''}${blendDrift.toFixed(3)}/gal)`,
  );
  console.log(`  national average: $${live.nationalAvg.toFixed(3)}`);
  console.log(`  fill in ${live.cheapestState} at $${live.cheapestPrice.toFixed(3)}\n`);

  // What the drift is worth on a full tank.
  const perFill = Math.abs(blendDrift) * 250;
  console.log(`  On a 250-gallon fill the snapshot was off by about $${perFill.toFixed(0)}.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
