/**
 * Where does the time actually go?
 *
 * Run with `npm run bench`. Measures the paths a driver waits on: building a
 * brief, and building a fleet report. Everything here is pure computation —
 * the numbers are the floor the UI can hit, before React and network.
 */
import { buildFleetReport } from '../src/calc/fleet';
import { DEFAULT_PROFILE } from '../src/data/defaults';
import { cityById, haversineMiles, nearestState } from '../src/data/geo';
import { buildTripBrief } from '../src/services';
import { MockRouting } from '../src/services/routing';
import type { Driver, LedgerEntry, TripInput, Truck } from '../src/types';
import { defaultOptionalCosts } from '../src/data/optionalCosts';

const bench = async (label: string, iterations: number, fn: () => unknown | Promise<unknown>) => {
  // Warm up so we measure steady state, not first-call JIT.
  for (let i = 0; i < Math.min(3, iterations); i++) await fn();

  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const total = performance.now() - t0;

  const per = total / iterations;
  const flag = per > 100 ? '  ← SLOW' : per > 33 ? '  ← drops a frame' : '';
  console.log(`  ${label.padEnd(42)} ${per.toFixed(2).padStart(8)} ms/op${flag}`);
};

function trip(over: Partial<TripInput> = {}): TripInput {
  return {
    origin: cityById('lar')!,
    destination: cityById('sea')!, // Long haul: the worst case for routing.
    stops: [],
    deadheadMiles: 85,
    departAt: '2026-01-14T06:00:00.000Z',
    equipment: 'reefer',
    grossWeightLbs: 78500,
    rate: 3.15,
    rateMode: 'per-mile',
    hazmat: null,
    reeferSetPointF: 34,
    oversize: false,
    optionalCosts: defaultOptionalCosts(),
    deliverBy: null,
    ...over,
  };
}

function mkTruck(id: string): Truck {
  return {
    id,
    unitNumber: id,
    nickname: '',
    year: 2021,
    make: 'Freightliner',
    model: 'Cascadia',
    vin: '',
    plate: '',
    active: true,
    profile: { ...DEFAULT_PROFILE },
    plannedMilesPerDay: 500,
    targetRatePerMile: 2.6,
    inServiceSince: '2024-01-01T00:00:00.000Z',
  };
}

function mkDriver(id: string, truckId: string): Driver {
  return {
    id,
    firstName: 'D',
    lastName: id,
    phone: '',
    email: '',
    cdlNumber: '',
    cdlState: 'TX',
    cdlClass: 'A',
    cdlExpires: '2030-01-01T00:00:00.000Z',
    endorsements: [],
    medicalCardExpires: '2030-01-01T00:00:00.000Z',
    hireDate: '2024-01-01T00:00:00.000Z',
    status: 'active',
    assignedTruckId: truckId,
    payMode: 'per-mile',
    payRate: 0.65,
    hosCycle: 70,
    notes: '',
  };
}

async function main() {
  console.log('\nTripCost — hot paths\n');

  // --- Primitives ---------------------------------------------------------
  const a = cityById('lar')!;
  const b = cityById('sea')!;
  console.log('Primitives');
  await bench('haversineMiles', 200_000, () => haversineMiles(a, b));
  await bench('nearestState (per sample point)', 20_000, () => nearestState(a));

  // --- Routing ------------------------------------------------------------
  console.log('\nRouting');
  const routing = new MockRouting();
  await bench('route — 1 leg, coast to coast', 200, () => routing.route(trip()));
  await bench(
    'route — 3 stops',
    200,
    () =>
      routing.route(
        trip({ stops: [cityById('den')!, cityById('slc')!] }),
      ),
  );

  // --- Full brief ---------------------------------------------------------
  console.log('\nFull brief (what the driver waits on)');
  await bench('buildTripBrief — long haul', 100, () => buildTripBrief(trip(), DEFAULT_PROFILE));
  await bench(
    'buildTripBrief — short haul',
    100,
    () => buildTripBrief(trip({ destination: cityById('hou')! }), DEFAULT_PROFILE),
  );

  // --- Fleet --------------------------------------------------------------
  console.log('\nFleet report (recomputed on every keystroke/toggle)');
  const anchor = new Date('2026-03-15T12:00:00.000Z');
  for (const size of [3, 25, 100]) {
    const trucks = Array.from({ length: size }, (_, i) => mkTruck(String(100 + i)));
    const drivers = trucks.map((t, i) => mkDriver(`d${i}`, t.id));
    const ledger: LedgerEntry[] = trucks.flatMap((t, i) =>
      Array.from({ length: 8 }, (_, j) => ({
        id: `l${i}-${j}`,
        truckId: t.id,
        date: '2026-03-12T00:00:00.000Z',
        kind: 'expense' as const,
        category: 'tow' as const,
        label: 'Tow',
        amount: 900,
        miles: 0,
        note: '',
      })),
    );
    await bench(
      `buildFleetReport — ${size} trucks, ${ledger.length} entries`,
      size > 50 ? 100 : 500,
      () => buildFleetReport(trucks, ledger, 'month', [], 3.78, anchor, drivers),
    );
  }

  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
