/**
 * Is the NWS alerts feed reachable, and does the filter keep the right things?
 *
 * Run with `npm run check:alerts`. Checks a few places where trucking weather
 * actually happens and prints what a driver there would be told right now.
 */
import { NwsAlerts } from '../src/services/alerts';

const SPOTS: { name: string; lat: number; lon: number }[] = [
  { name: 'Cheyenne, WY (I-80 wind country)', lat: 41.14, lon: -104.82 },
  { name: 'Denver, CO (I-70 passes)', lat: 39.739, lon: -104.99 },
  { name: 'Fargo, ND (I-94 winter)', lat: 46.877, lon: -96.79 },
  { name: 'Amarillo, TX (dust + ice)', lat: 35.222, lon: -101.831 },
  { name: 'Miami, FL (tropical)', lat: 25.762, lon: -80.192 },
];

async function main() {
  const provider = new NwsAlerts('TripCost (support@example.com)');
  console.log('\nLive NWS alerts, filtered to what changes how a truck runs\n');

  let total = 0;
  for (const spot of SPOTS) {
    const t0 = Date.now();
    const alerts = await provider.check({ lat: spot.lat, lon: spot.lon }, null);
    const ms = Date.now() - t0;
    total += alerts.length;

    console.log(`── ${spot.name}  (${ms} ms)`);
    if (alerts.length === 0) {
      console.log('     nothing active\n');
      continue;
    }
    for (const a of alerts) {
      console.log(`     ${a.critical ? '[WARN]' : '[info]'} ${a.event}`);
      console.log(`            ${a.headline.slice(0, 110)}`);
      console.log(`            severity=${a.severity} urgency=${a.urgency}`);
    }
    console.log('');
  }

  console.log(`${total} relevant alert(s) across ${SPOTS.length} locations.`);
  console.log('Reachability is what this proves — an empty result is a valid answer.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
