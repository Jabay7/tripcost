/**
 * Is the National Weather Service reachable, and does it return sane data?
 *
 * Run with `npm run check:weather`. Prints the modeled forecast and the live
 * one side by side for the same trip, so you can see at a glance whether the
 * live feed is actually being used and whether its numbers look right.
 *
 * Useful before shipping, and useful when a driver reports weather that does
 * not match what they see out the windshield.
 */
import { DEFAULT_PROFILE } from '../src/data/defaults';
import { cityById } from '../src/data/geo';
import { defaultOptionalCosts } from '../src/data/optionalCosts';
import { buildTripBrief, DEFAULT_SERVICES, MOCK_SERVICES } from '../src/services';
import type { TripInput } from '../src/types';

const trip: TripInput = {
  origin: cityById('den')!,
  destination: cityById('chi')!,
  stops: [],
  deadheadMiles: 0,
  // A few hours out, so the forecast lands inside the NWS hourly window.
  departAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
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
  console.log(`\n${trip.origin.name} → ${trip.destination.name}\n`);

  console.log('── MODELED ' + '─'.repeat(58));
  const t0 = Date.now();
  const offline = await buildTripBrief(trip, DEFAULT_PROFILE, [], MOCK_SERVICES);
  console.log(`${Date.now() - t0} ms · ${offline.weather.provider}\n`);
  for (const p of offline.weather.points) {
    console.log(`  ${p.state.padEnd(3)} ${String(p.tempF).padStart(4)}°F  ${p.summary}`);
  }

  console.log('\n── LIVE ' + '─'.repeat(61));
  const t1 = Date.now();
  const live = await buildTripBrief(trip, DEFAULT_PROFILE, [], DEFAULT_SERVICES);
  const elapsed = Date.now() - t1;
  console.log(`${elapsed} ms · ${live.weather.provider}\n`);
  for (const p of live.weather.points) {
    console.log(`  ${p.state.padEnd(3)} ${String(p.tempF).padStart(4)}°F  ${p.summary}`);
    for (const a of p.alerts) console.log(`         ⚠ ${a.slice(0, 100)}`);
  }

  console.log('\n── SOURCES ' + '─'.repeat(58));
  for (const s of live.sources) {
    console.log(`  ${s.service.padEnd(14)} ${(s.live ? 'LIVE' : 'OFFLINE').padEnd(8)} ${s.provider}`);
  }

  const identical = live.weather.points.every(
    (p, i) => p.summary === offline.weather.points[i]?.summary,
  );
  console.log(
    `\n  ${identical ? '✗ live and modeled are identical — NWS is probably unreachable' : '✓ live data differs from the model, as expected'}`,
  );
  console.log(`  risk: ${live.risk.level} ${live.risk.score}/100`);
  console.log(`  ${elapsed} ms for ${live.weather.points.length} segments\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
