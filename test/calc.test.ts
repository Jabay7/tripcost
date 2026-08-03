import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeCosts } from '../src/calc/costs';
import { buildFleetReport, complianceAlerts, driverName, periodBounds } from '../src/calc/fleet';
import { planHos } from '../src/calc/hos';
import { assessRisk } from '../src/calc/risk';
import { DEFAULT_PROFILE } from '../src/data/defaults';
import { cityById, haversineMiles } from '../src/data/geo';
import {
  defaultOptionalCosts,
  OPTIONAL_COSTS,
  withOptional,
} from '../src/data/optionalCosts';
import {
  defaultExtractor,
  MockExtractor,
  ProxyExtractor,
} from '../src/services/documents';
import {
  buildTripBrief,
  MockFuel,
  MockRestrictions,
  MockRouting,
  MockTraffic,
  MockWeather,
} from '../src/services';
import type { AddedCost, Driver, LedgerEntry, TripInput, Truck } from '../src/types';

const DALLAS = cityById('dal')!;
const CHICAGO = cityById('chi')!;
const LOS_ANGELES = cityById('lax')!;

function trip(overrides: Partial<TripInput> = {}): TripInput {
  return {
    origin: DALLAS,
    destination: CHICAGO,
    stops: [],
    deadheadMiles: 50,
    departAt: '2026-03-10T08:00:00.000Z',
    equipment: 'dry-van',
    grossWeightLbs: 62000,
    rate: 2.6,
    rateMode: 'per-mile',
    hazmat: null,
    reeferSetPointF: null,
    oversize: false,
    optionalCosts: defaultOptionalCosts(),
    deliverBy: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('geo', () => {
  it('measures a known corridor within a sane tolerance', () => {
    // Dallas to Chicago is roughly 800 miles straight-line, ~925 by road.
    const d = haversineMiles(DALLAS, CHICAGO);
    assert.ok(d > 750 && d < 850, `expected ~800, got ${d.toFixed(0)}`);
  });
});

describe('routing', () => {
  it('attributes miles to the states actually crossed', async () => {
    const route = await new MockRouting().route(trip());
    assert.ok(route.states.includes('TX'), 'should start in Texas');
    assert.ok(route.states.includes('IL'), 'should end in Illinois');
    // Straight-line inflated by the circuity factor, plus deadhead.
    assert.ok(route.totalMiles > 900 && route.totalMiles < 1050);
  });

  it('sums segment miles to the loaded distance', async () => {
    const t = trip();
    const route = await new MockRouting().route(t);
    const segSum = route.segments.reduce((s, x) => s + x.miles, 0);
    assert.ok(Math.abs(segSum + t.deadheadMiles - route.totalMiles) < 1);
  });
});

describe('hours of service', () => {
  it('keeps a short run inside a single 14-hour window', async () => {
    const t = trip({ destination: cityById('hou')! }); // ~240 mi
    const route = await new MockRouting().route(t);
    const hos = planHos(route, t, DEFAULT_PROFILE, 0);
    assert.equal(hos.nightsOut, 0);
    assert.ok(hos.drivingHours < 11);
  });

  it('forces a reset on a run that cannot be done in one shift', async () => {
    const t = trip({ destination: LOS_ANGELES }); // ~1,400 mi
    const route = await new MockRouting().route(t);
    const hos = planHos(route, t, DEFAULT_PROFILE, 0);
    assert.ok(hos.nightsOut >= 2, `expected 2+ resets, got ${hos.nightsOut}`);
    assert.ok(hos.stops.some((s) => s.kind === '10-hr-reset'));
  });

  it('never drives more than 11 hours between resets', async () => {
    const t = trip({ destination: LOS_ANGELES });
    const route = await new MockRouting().route(t);
    const hos = planHos(route, t, DEFAULT_PROFILE, 0);

    // Reconstruct driving between resets from the mile markers.
    const resets = hos.stops.filter((s) => s.kind === '10-hr-reset');
    let prevMile = 0;
    for (const r of resets) {
      const drivenHours = (r.atMile - prevMile) / DEFAULT_PROFILE.avgSpeedMph;
      assert.ok(drivenHours <= 11.01, `drove ${drivenHours.toFixed(2)} hr in one window`);
      prevMile = r.atMile;
    }
  });

  it('schedules the 30-minute break', async () => {
    const t = trip({ destination: LOS_ANGELES });
    const route = await new MockRouting().route(t);
    const hos = planHos(route, t, DEFAULT_PROFILE, 0);
    assert.ok(hos.stops.some((s) => s.kind === '30-min-break'));
  });

  it('keeps every stop marker inside the route, even with traffic delay', async () => {
    const t = trip({ destination: LOS_ANGELES });
    const route = await new MockRouting().route(t);
    // A big delay used to inflate mile markers past the destination, because
    // distance was derived from elapsed driving hours times speed.
    const hos = planHos(route, t, DEFAULT_PROFILE, 240);

    for (const stop of hos.stops) {
      assert.ok(
        stop.atMile <= Math.round(route.totalMiles),
        `${stop.kind} at mile ${stop.atMile} is past the ${Math.round(route.totalMiles)} mi destination`,
      );
      assert.ok(stop.atMile >= 0);
    }
  });

  it('spends traffic delay on the clock without adding distance', async () => {
    const t = trip({ destination: LOS_ANGELES });
    const route = await new MockRouting().route(t);
    const clean = planHos(route, t, DEFAULT_PROFILE, 0);
    const jammed = planHos(route, t, DEFAULT_PROFILE, 180);

    assert.ok(jammed.drivingHours > clean.drivingHours, 'delay must cost time');
    assert.ok(
      jammed.totalElapsedHours > clean.totalElapsedHours,
      'delay must push the arrival out',
    );
  });

  it('flags a load that cannot be delivered legally on time', async () => {
    const t = trip({
      destination: LOS_ANGELES,
      deliverBy: '2026-03-11T08:00:00.000Z', // 24 hr for a 1,400 mi run
    });
    const route = await new MockRouting().route(t);
    const hos = planHos(route, t, DEFAULT_PROFILE, 0);
    assert.equal(hos.legalOnTime, false);
    assert.ok(hos.slackHours < 0);
  });
});

describe('cost engine', () => {
  it('counts deadhead as cost but not revenue', async () => {
    const withDeadhead = await buildTripBrief(trip({ deadheadMiles: 200 }), DEFAULT_PROFILE);
    const without = await buildTripBrief(trip({ deadheadMiles: 0 }), DEFAULT_PROFILE);

    assert.ok(
      withDeadhead.cost.totalCost > without.cost.totalCost,
      'deadhead must raise cost',
    );
    assert.equal(
      withDeadhead.cost.committedRevenue,
      without.cost.committedRevenue,
      'deadhead must not change revenue',
    );
  });

  it('produces a profit that reconciles with revenue minus cost', async () => {
    const b = await buildTripBrief(trip(), DEFAULT_PROFILE);
    assert.ok(
      Math.abs(b.cost.netProfit - (b.cost.committedRevenue - b.cost.totalCost)) < 0.02,
    );
  });

  it('never reports cash-to-float above total cost', async () => {
    const b = await buildTripBrief(
      trip({ optionalCosts: withOptional({ lumper: 300 }) }),
      DEFAULT_PROFILE,
    );
    assert.ok(b.cost.cashToFloat > 0);
    assert.ok(b.cost.cashToFloat <= b.cost.totalCost + 0.01);
  });

  it('adds user-entered costs to the total and to cash-to-float', async () => {
    const added: AddedCost[] = [
      {
        id: 'x1',
        label: 'Heavy-duty tow',
        amount: 1200,
        category: 'tow',
        note: 'Air system failure',
        outOfPocket: true,
        reimbursable: false,
        incurredAt: '2026-03-10T18:00:00.000Z',
      },
    ];
    const base = await buildTripBrief(trip(), DEFAULT_PROFILE);
    const withCost = await buildTripBrief(trip(), DEFAULT_PROFILE, added);

    assert.ok(Math.abs(withCost.cost.totalCost - base.cost.totalCost - 1200) < 0.02);
    assert.ok(Math.abs(withCost.cost.cashToFloat - base.cost.cashToFloat - 1200) < 0.02);
    assert.ok(withCost.cost.lines.some((l) => l.label === 'Heavy-duty tow'));
  });

  it('charges reefer fuel only when the unit is running', async () => {
    const dry = await buildTripBrief(trip({ equipment: 'dry-van' }), DEFAULT_PROFILE);
    const reefer = await buildTripBrief(
      trip({ equipment: 'reefer', reeferSetPointF: 34 }),
      DEFAULT_PROFILE,
    );
    assert.ok(!dry.cost.lines.some((l) => l.key === 'reefer-fuel'));
    assert.ok(reefer.cost.lines.some((l) => l.key === 'reefer-fuel'));
  });

  it('computes a break-even rate that separates a good load from a bad one', async () => {
    const good = await buildTripBrief(trip({ rate: 3.5 }), DEFAULT_PROFILE);
    const bad = await buildTripBrief(trip({ rate: 1.1 }), DEFAULT_PROFILE);
    assert.ok(good.cost.netProfit > 0, 'a $3.50/mi load should profit');
    assert.ok(bad.cost.netProfit < 0, 'a $1.10/mi load should lose money');
    assert.ok(bad.cost.revenuePerMile < bad.cost.breakEvenRatePerMile);
  });
});

describe('optional costs', () => {
  it('charges nothing that was not selected', async () => {
    const b = await buildTripBrief(trip(), DEFAULT_PROFILE);

    assert.equal(b.cost.optionalTotal, 0);
    assert.ok(!b.cost.lines.some((l) => l.group === 'optional'));
    // The classic quiet-billing bugs: a pilot car or lumper nobody asked for.
    assert.ok(!b.cost.lines.some((l) => l.label.includes('escort')));
    assert.ok(!b.cost.lines.some((l) => l.label.includes('Lumper')));
  });

  it('does not bill an oversize load for an escort unless it was chosen', async () => {
    const b = await buildTripBrief(trip({ oversize: true }), DEFAULT_PROFILE);
    assert.equal(b.cost.optionalTotal, 0, 'oversize alone must not add cost');

    const withEscort = await buildTripBrief(
      trip({ oversize: true, optionalCosts: withOptional({ escort: 2.25 }) }),
      DEFAULT_PROFILE,
    );
    assert.ok(withEscort.cost.optionalTotal > 0);
    assert.ok(withEscort.cost.totalCost > b.cost.totalCost);
  });

  it('does not bill a reefer for a washout unless it was chosen', async () => {
    const b = await buildTripBrief(
      trip({ equipment: 'reefer', reeferSetPointF: 34 }),
      DEFAULT_PROFILE,
    );
    assert.ok(!b.cost.lines.some((l) => l.key === 'opt-washout'));
    // Reefer *fuel* is not optional — the unit runs regardless.
    assert.ok(b.cost.lines.some((l) => l.key === 'reefer-fuel' && l.group === 'fixed'));
  });

  it('prices a per-mile optional against the real route distance', async () => {
    const b = await buildTripBrief(
      trip({ oversize: true, optionalCosts: withOptional({ escort: 2 }) }),
      DEFAULT_PROFILE,
    );
    const escort = b.cost.lines.find((l) => l.key === 'opt-escort')!;
    assert.ok(
      Math.abs(escort.amount - b.route.totalMiles * 2) < 1,
      `escort ${escort.amount} should be 2 × ${b.route.totalMiles} miles`,
    );
  });

  it('prices a per-night optional against nights actually spent out', async () => {
    const b = await buildTripBrief(
      trip({
        destination: LOS_ANGELES,
        optionalCosts: withOptional({ 'reserved-parking': 25 }),
      }),
      DEFAULT_PROFILE,
    );
    const parking = b.cost.lines.find((l) => l.key === 'opt-reserved-parking')!;
    assert.ok(b.hos.nightsOut > 0);
    assert.equal(parking.amount, b.hos.nightsOut * 25);
  });

  it('prices a per-state optional against states actually crossed', async () => {
    const b = await buildTripBrief(
      trip({ oversize: true, optionalCosts: withOptional({ 'oversize-permits': 40 }) }),
      DEFAULT_PROFILE,
    );
    const permits = b.cost.lines.find((l) => l.key === 'opt-oversize-permits')!;
    assert.equal(permits.amount, b.route.states.length * 40);
  });

  it('splits the total into fixed, optional and unplanned without losing money', async () => {
    const b = await buildTripBrief(
      trip({ optionalCosts: withOptional({ lumper: 250, washout: true }) }),
      DEFAULT_PROFILE,
      [
        {
          id: 'i1',
          label: 'Tow',
          amount: 900,
          category: 'tow',
          note: '',
          outOfPocket: true,
          reimbursable: false,
          incurredAt: '2026-03-10T12:00:00.000Z',
        },
      ],
    );

    assert.ok(b.cost.fixedTotal > 0);
    assert.ok(b.cost.optionalTotal > 0);
    assert.equal(b.cost.incidentTotal, 900);
    assert.ok(
      Math.abs(b.cost.fixedTotal + b.cost.optionalTotal + b.cost.incidentTotal - b.cost.totalCost) < 0.05,
      'the three groups must add up to the total',
    );
  });

  it('keeps fuel, tolls and the truck payment in the fixed group', async () => {
    const b = await buildTripBrief(trip(), DEFAULT_PROFILE);
    for (const key of ['fuel', 'tolls', 'fixed', 'tires', 'maintenance']) {
      const line = b.cost.lines.find((l) => l.key === key);
      assert.ok(line, `expected a ${key} line`);
      assert.equal(line.group, 'fixed', `${key} must not be optional`);
    }
  });

  it('suggests the right extras for the load without enabling them', () => {
    const oversize = trip({ oversize: true });
    const suggested = OPTIONAL_COSTS.filter((o) => o.suggest(oversize)).map((o) => o.key);
    assert.ok(suggested.includes('escort'));
    assert.ok(suggested.includes('oversize-permits'));

    const flatbed = trip({ equipment: 'flatbed' });
    assert.ok(OPTIONAL_COSTS.filter((o) => o.suggest(flatbed)).map((o) => o.key).includes('securement'));

    // Suggestion is advisory only — the defaults are all off.
    assert.ok(defaultOptionalCosts().every((o) => !o.enabled));
  });
});

describe('fuel', () => {
  it('blends prices by miles driven in each state', async () => {
    const route = await new MockRouting().route(trip());
    const fuel = await new MockFuel().prices(route);
    const prices = fuel.byState.map((q) => q.pricePerGal);
    assert.ok(fuel.blendedPricePerGal >= Math.min(...prices));
    assert.ok(fuel.blendedPricePerGal <= Math.max(...prices));
  });

  it('prices Pennsylvania above Texas, as the tax burden dictates', async () => {
    const route = await new MockRouting().route(
      trip({ origin: cityById('hou')!, destination: cityById('phi')! }),
    );
    const fuel = await new MockFuel().prices(route);
    const tx = fuel.byState.find((q) => q.state === 'TX');
    const pa = fuel.byState.find((q) => q.state === 'PA');
    if (tx && pa) assert.ok(pa.pricePerGal > tx.pricePerGal);
  });
});

describe('weather', () => {
  const forecastFor = async (t: TripInput) => {
    const route = await new MockRouting().route(t);
    const depart = new Date(t.departAt);
    // Simple ETA mapping is enough here — we only care about the season.
    return new MockWeather().forecast(route, (mile) =>
      new Date(depart.getTime() + (mile / 55) * 3_600_000),
    );
  };

  it('puts January below July, not above it', async () => {
    const winter = await forecastFor(trip({ departAt: '2026-01-15T08:00:00.000Z' }));
    const summer = await forecastFor(trip({ departAt: '2026-07-15T08:00:00.000Z' }));

    const avg = (r: Awaited<ReturnType<typeof forecastFor>>) =>
      r.points.reduce((s, p) => s + p.tempF, 0) / r.points.length;

    assert.ok(
      avg(summer) > avg(winter) + 15,
      `July (${avg(summer).toFixed(0)}°F) should be well above January (${avg(winter).toFixed(0)}°F)`,
    );
  });

  it('keeps temperatures inside a physically sane range', async () => {
    for (const month of ['01', '04', '07', '10']) {
      const r = await forecastFor(
        trip({ destination: LOS_ANGELES, departAt: `2026-${month}-15T08:00:00.000Z` }),
      );
      for (const p of r.points) {
        assert.ok(
          p.tempF > -40 && p.tempF < 120,
          `${p.state} in month ${month} reported ${p.tempF}°F`,
        );
      }
    }
  });

  it('reports a Texas January in the 40s to 70s, not the 110s', async () => {
    const r = await forecastFor(
      trip({ origin: cityById('lar')!, destination: cityById('hou')!, departAt: '2026-01-15T08:00:00.000Z' }),
    );
    for (const p of r.points) {
      assert.ok(p.tempF > 30 && p.tempF < 85, `south Texas January reported ${p.tempF}°F`);
    }
  });

  it('keeps gusts within a believable factor of sustained wind', async () => {
    const r = await forecastFor(trip({ destination: LOS_ANGELES }));
    for (const p of r.points) {
      assert.ok(p.gustMph >= p.windMph, 'gusts are never below sustained wind');
      assert.ok(
        p.gustMph <= p.windMph * 1.6 + 1 && p.gustMph <= p.windMph + 25,
        `${p.state} gust ${p.gustMph} against sustained ${p.windMph} is not plausible`,
      );
    }
  });

  it('produces frozen precipitation only when it is cold enough', async () => {
    const r = await forecastFor(
      trip({ origin: cityById('msp')!, destination: cityById('fgo')!, departAt: '2026-01-15T08:00:00.000Z' }),
    );
    for (const p of r.points) {
      if (p.precip === 'snow') assert.ok(p.tempF <= 32, `snow reported at ${p.tempF}°F`);
      if (p.precip === 'rain') assert.ok(p.tempF > 34, `rain reported at ${p.tempF}°F`);
    }
  });
});

describe('restrictions', () => {
  it('flags the Eisenhower Tunnel hazmat ban on an I-70 hazmat run', async () => {
    const t = trip({
      origin: cityById('den')!,
      destination: cityById('slc')!,
      hazmat: '3-flammable-liquid',
    });
    const route = await new MockRouting().route(t);
    const rep = await new MockRestrictions().check(route, t, new Date(t.departAt));
    assert.ok(
      rep.restrictions.some((r) => r.kind === 'tunnel' && r.state === 'CO'),
      'Colorado hazmat tunnel restriction should appear',
    );
  });

  it('treats an overweight load without a permit as blocking', async () => {
    const t = trip({ grossWeightLbs: 88000 });
    const route = await new MockRouting().route(t);
    const rep = await new MockRestrictions().check(route, t, new Date(t.departAt));
    assert.ok(rep.restrictions.some((r) => r.kind === 'weight-limit' && r.blocking));
  });
});

describe('risk', () => {
  it('escalates to RED when the load cannot be delivered legally on time', async () => {
    const t = trip({ destination: LOS_ANGELES, deliverBy: '2026-03-11T00:00:00.000Z' });
    const route = await new MockRouting().route(t);
    const traffic = await new MockTraffic().incidents(route);
    const hos = planHos(route, t, DEFAULT_PROFILE, traffic.totalDelayMinutes);
    const restrictions = await new MockRestrictions().check(route, t, new Date(t.departAt));
    const weather = { points: [], worst: 'clear' as const, provider: 'test' };

    const risk = assessRisk(route, t, weather, traffic, restrictions, hos);
    assert.ok(risk.score >= 25, `expected elevated risk, got ${risk.score}`);
    assert.ok(risk.factors.some((f) => f.label.includes('legally')));
  });

  it('stays GREEN on a clean short run', async () => {
    const t = trip({ origin: DALLAS, destination: cityById('hou')! });
    const route = await new MockRouting().route(t);
    const weather = { points: [], worst: 'clear' as const, provider: 'test' };
    const traffic = { incidents: [], totalDelayMinutes: 0, provider: 'test' };
    const restrictions = { restrictions: [], provider: 'test' };
    const hos = planHos(route, t, DEFAULT_PROFILE, 0);

    const risk = assessRisk(route, t, weather, traffic, restrictions, hos);
    assert.equal(risk.level, 'GREEN');
  });
});

describe('full brief', () => {
  it('assembles every section', async () => {
    const b = await buildTripBrief(trip(), DEFAULT_PROFILE);
    assert.ok(b.route.totalMiles > 0);
    assert.ok(b.fuel.blendedPricePerGal > 0);
    assert.ok(b.weather.points.length > 0);
    assert.ok(b.hos.stops.length > 0);
    assert.ok(b.cost.lines.length > 0);
    assert.ok(b.risk.bottomLine.length > 0);
    assert.equal(b.containsMockData, true);
  });

  it('forecasts weather for when the truck is actually there, not departure time', async () => {
    const b = await buildTripBrief(trip({ destination: LOS_ANGELES }), DEFAULT_PROFILE);
    const first = new Date(b.weather.points[0].eta).getTime();
    const last = new Date(b.weather.points[b.weather.points.length - 1].eta).getTime();
    assert.ok(last > first, 'later segments must have later ETAs');
    assert.ok(last - first > 12 * 3_600_000, 'a coast-to-coast run spans more than 12 hours');
  });
});

// ---------------------------------------------------------------------------

function makeTestTruck(id: string, over: Partial<Truck> = {}): Truck {
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
    ...over,
  };
}

/** ISO date `days` from the fleet-test anchor. */
function fromAnchor(anchor: Date, days: number): string {
  return new Date(anchor.getTime() + days * 86_400_000).toISOString();
}

function makeTestDriver(id: string, over: Partial<Driver> = {}): Driver {
  return {
    id,
    firstName: 'Test',
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
    assignedTruckId: null,
    payMode: 'per-mile',
    payRate: 0.65,
    hosCycle: 70,
    notes: '',
    ...over,
  };
}

describe('fleet report', () => {
  const anchor = new Date('2026-03-15T12:00:00.000Z');

  it('scopes to the selected trucks and reports their share of the fleet', () => {
    const trucks = [makeTestTruck('101'), makeTestTruck('102'), makeTestTruck('103')];
    const all = buildFleetReport(trucks, [], 'month', [], 3.78, anchor);
    const two = buildFleetReport(trucks, [], 'month', ['101', '102'], 3.78, anchor);

    assert.equal(all.perTruck.length, 3);
    assert.equal(two.perTruck.length, 2);
    assert.ok(two.combined.totalCost < all.combined.totalCost);
    // Three identical trucks: any two should be about two thirds of the cost.
    assert.ok(Math.abs(two.shareOfFleetCost - 66.7) < 1.5, `got ${two.shareOfFleetCost}`);
  });

  it('accrues fixed cost on calendar days even for an idle truck', () => {
    const idle = makeTestTruck('200', { active: false });
    const r = buildFleetReport([idle], [], 'month', [], 3.78, anchor);
    assert.equal(r.combined.miles, 0);
    assert.ok(r.combined.fixedCost > 0, 'an idle truck still owes its payment');
    assert.ok(r.combined.fuelCost === 0, 'an idle truck burns no fuel');
  });

  it('scales cost with the period length', () => {
    const trucks = [makeTestTruck('301')];
    const week = buildFleetReport(trucks, [], 'week', [], 3.78, anchor);
    const month = buildFleetReport(trucks, [], 'month', [], 3.78, anchor);
    const ratio = month.combined.totalCost / week.combined.totalCost;
    assert.ok(ratio > 3.5 && ratio < 5, `30/7 days should be ~4.3x, got ${ratio.toFixed(2)}`);
  });

  it('folds recorded incidents into the truck that incurred them', () => {
    const trucks = [makeTestTruck('401'), makeTestTruck('402')];
    const ledger: LedgerEntry[] = [
      {
        id: 'l1',
        truckId: '401',
        date: '2026-03-12T00:00:00.000Z',
        kind: 'expense',
        category: 'tow',
        label: 'Heavy-duty tow',
        amount: 1500,
        miles: 0,
        note: '',
      },
    ];
    const r = buildFleetReport(trucks, ledger, 'month', [], 3.78, anchor);
    const t401 = r.perTruck.find((t) => t.truckId === '401')!;
    const t402 = r.perTruck.find((t) => t.truckId === '402')!;

    assert.equal(t401.incidentCost, 1500);
    assert.equal(t401.incidentCount, 1);
    assert.equal(t402.incidentCost, 0);
    assert.ok(t401.costPerMile > t402.costPerMile, 'the tow must show up in cost per mile');
  });

  it('ignores ledger entries outside the window', () => {
    const trucks = [makeTestTruck('501')];
    const ledger: LedgerEntry[] = [
      {
        id: 'old',
        truckId: '501',
        date: '2025-01-01T00:00:00.000Z',
        kind: 'expense',
        category: 'tow',
        label: 'Old tow',
        amount: 9999,
        miles: 0,
        note: '',
      },
    ];
    const r = buildFleetReport(trucks, ledger, 'week', [], 3.78, anchor);
    assert.equal(r.combined.incidentCost, 0);
  });

  it('computes an operating ratio that flags an unprofitable truck', () => {
    const cheapRate = makeTestTruck('601', { targetRatePerMile: 0.8 });
    const r = buildFleetReport([cheapRate], [], 'month', [], 3.78, anchor);
    assert.ok(r.combined.operatingRatio > 100, 'should be losing money');
    assert.ok(r.combined.netProfit < 0);
  });

  it('bounds the period correctly', () => {
    const { from, to, days } = periodBounds('week', anchor);
    assert.equal(days, 7);
    assert.equal(Math.round((to.getTime() - from.getTime()) / 86_400_000), 6);
  });

  it('rolls per-truck buckets into the combined view without losing money', () => {
    const trucks = [makeTestTruck('701'), makeTestTruck('702')];
    const r = buildFleetReport(trucks, [], 'month', [], 3.78, anchor);
    const bucketSum = r.combined.buckets.reduce((s, b) => s + b.amount, 0);
    assert.ok(
      Math.abs(bucketSum - r.combined.totalCost) < 1,
      `buckets ${bucketSum.toFixed(2)} vs total ${r.combined.totalCost.toFixed(2)}`,
    );
  });
});

describe('document extraction', () => {
  it('reads an image as an expense, not a load', async () => {
    const doc = await new MockExtractor().extract({
      base64: 'QUJD',
      mediaType: 'image/jpeg',
      filename: 'tow.jpg',
    });
    assert.equal(doc.kind, 'expense');
    assert.ok(doc.expense);
    assert.equal(doc.load, null, 'an invoice is not a load');
    assert.ok(doc.expense.total > 0);
  });

  it('reads a rate confirmation as a load, not an expense', async () => {
    const doc = await new MockExtractor().extract({
      base64: 'QUJD',
      mediaType: 'application/pdf',
      filename: 'ratecon.pdf',
    });
    assert.equal(doc.kind, 'load');
    assert.ok(doc.load);
    assert.equal(doc.expense, null, 'freight ahead is revenue, not cost');
  });

  it('never claims sample data is live', async () => {
    for (const mediaType of ['image/jpeg', 'application/pdf']) {
      const doc = await new MockExtractor().extract({ base64: 'QUJD', mediaType, filename: 'x' });
      assert.equal(doc.live, false);
      assert.ok(
        doc.warnings.some((w) => w.toLowerCase().includes('sample')),
        'offline extraction must say so in its warnings',
      );
    }
  });

  it('falls back to the offline extractor when no server is configured', () => {
    const before = process.env.EXPO_PUBLIC_API_BASE;
    delete process.env.EXPO_PUBLIC_API_BASE;
    assert.equal(defaultExtractor().live, false);

    process.env.EXPO_PUBLIC_API_BASE = 'http://localhost:8787';
    assert.equal(defaultExtractor().live, true);

    if (before === undefined) delete process.env.EXPO_PUBLIC_API_BASE;
    else process.env.EXPO_PUBLIC_API_BASE = before;
  });

  it('surfaces a server failure instead of inventing a result', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('upstream exploded', { status: 500 })) as typeof fetch;

    try {
      await assert.rejects(
        () =>
          new ProxyExtractor('http://localhost:9999').extract({
            base64: 'QUJD',
            mediaType: 'image/jpeg',
            filename: 'x.jpg',
          }),
        /Extraction failed \(500\)/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('marks a proxy result as live and tolerates a trailing slash in the base URL', async () => {
    const payload = {
      kind: 'expense',
      confidence: 'high',
      summary: 'Tire bill',
      expense: {
        vendor: 'Roadside Tire',
        date: '2026-03-10T00:00:00.000Z',
        total: 640,
        category: 'tire',
        invoiceNumber: 'A-1',
        lineItems: [],
        gallons: null,
        pricePerGallon: null,
        looksReimbursable: false,
      },
      load: null,
      warnings: [],
      provider: 'server',
      live: false,
    };

    const originalFetch = globalThis.fetch;
    let calledUrl = '';
    globalThis.fetch = (async (url: string) => {
      calledUrl = String(url);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    try {
      const doc = await new ProxyExtractor('http://localhost:8787/').extract({
        base64: 'QUJD',
        mediaType: 'image/jpeg',
        filename: 'x.jpg',
      });
      assert.equal(calledUrl, 'http://localhost:8787/extract', 'no double slash');
      assert.equal(doc.live, true, 'a proxy result is live regardless of what the body claimed');
      assert.equal(doc.expense?.total, 640);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('drivers and compliance', () => {
  const anchor = new Date('2026-03-15T12:00:00.000Z');

  it('attributes a truck to the driver seated in it', () => {
    const trucks = [makeTestTruck('801'), makeTestTruck('802')];
    const drivers = [
      makeTestDriver('d1', { assignedTruckId: '801' }),
      makeTestDriver('d2', { assignedTruckId: '802' }),
    ];
    const r = buildFleetReport(trucks, [], 'month', [], 3.78, anchor, drivers);

    assert.equal(r.perDriver.length, 2);
    const d1 = r.perDriver.find((d) => d.driverId === 'd1')!;
    const t801 = r.perTruck.find((t) => t.truckId === '801')!;
    assert.equal(d1.truckLabel, 'Unit 801');
    assert.equal(d1.totalCost, t801.totalCost, 'solo driver carries the whole truck cost');
    assert.deepEqual(t801.driverNames, [driverName(drivers[0])]);
  });

  it('splits a truck between a team rather than double-counting it', () => {
    const trucks = [makeTestTruck('810')];
    const drivers = [
      makeTestDriver('t1', { assignedTruckId: '810' }),
      makeTestDriver('t2', { assignedTruckId: '810' }),
    ];
    const r = buildFleetReport(trucks, [], 'month', [], 3.78, anchor, drivers);
    const truckCost = r.perTruck[0].totalCost;
    const driverSum = r.perDriver.reduce((s, d) => s + d.totalCost, 0);

    assert.equal(r.perDriver.length, 2);
    assert.ok(
      Math.abs(driverSum - truckCost) < 1,
      `team cost ${driverSum} should equal truck cost ${truckCost}`,
    );
    assert.equal(r.perTruck[0].driverNames.length, 2);
  });

  it('attributes nothing to an unassigned driver', () => {
    const trucks = [makeTestTruck('820')];
    const drivers = [makeTestDriver('bench', { assignedTruckId: null })];
    const r = buildFleetReport(trucks, [], 'month', [], 3.78, anchor, drivers);

    const bench = r.perDriver.find((d) => d.driverId === 'bench')!;
    assert.equal(bench.totalCost, 0);
    assert.equal(bench.miles, 0);
    assert.equal(bench.truckLabel, 'Unassigned');
    assert.ok(r.perTruck[0].totalCost > 0, 'the empty truck still costs money');
  });

  it('flags an expired medical card as a hard stop', () => {
    const drivers = [
      makeTestDriver('exp', { medicalCardExpires: fromAnchor(anchor, -5) }),
    ];
    const alerts = complianceAlerts(drivers, anchor);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].severity, 'expired');
    assert.equal(alerts[0].kind, 'medical');
    assert.ok(alerts[0].message.includes('cannot legally operate'));
  });

  it('grades credential expiry by how close it is', () => {
    const drivers = [
      makeTestDriver('critical', { cdlExpires: fromAnchor(anchor, 20) }),
      makeTestDriver('warning', { cdlExpires: fromAnchor(anchor, 50) }),
      makeTestDriver('fine', { cdlExpires: fromAnchor(anchor, 400) }),
    ];
    const alerts = complianceAlerts(drivers, anchor);
    assert.equal(alerts.length, 2, 'the far-out credential should not alert');
    assert.equal(alerts.find((a) => a.driverId === 'critical')!.severity, 'critical');
    assert.equal(alerts.find((a) => a.driverId === 'warning')!.severity, 'warning');
  });

  it('does not chase compliance on inactive drivers', () => {
    const drivers = [
      makeTestDriver('gone', {
        status: 'inactive',
        medicalCardExpires: fromAnchor(anchor, -30),
      }),
    ];
    assert.equal(complianceAlerts(drivers, anchor).length, 0);
  });

  it('sorts expired items above upcoming ones', () => {
    const drivers = [
      makeTestDriver('soon', { cdlExpires: fromAnchor(anchor, 10) }),
      makeTestDriver('past', { cdlExpires: fromAnchor(anchor, -1) }),
    ];
    const alerts = complianceAlerts(drivers, anchor);
    assert.equal(alerts[0].driverId, 'past');
  });

  it('scopes driver rollups to the selected trucks', () => {
    const trucks = [makeTestTruck('901'), makeTestTruck('902')];
    const drivers = [
      makeTestDriver('a', { assignedTruckId: '901' }),
      makeTestDriver('b', { assignedTruckId: '902' }),
    ];
    const r = buildFleetReport(trucks, [], 'month', ['901'], 3.78, anchor, drivers);
    assert.ok(r.perDriver.some((d) => d.driverId === 'a'));
    assert.ok(!r.perDriver.some((d) => d.driverId === 'b'), 'driver on an unselected truck is excluded');
  });

  it('compares an owner-operator against a wage-excluded benchmark', () => {
    // DEFAULT_PROFILE is owner-operator: no wage line, so the full ~$2.27
    // benchmark would flatter it by roughly a dollar a mile.
    const trucks = [makeTestTruck('920')];
    const r = buildFleetReport(trucks, [], 'month', [], 3.78, anchor, []);
    const benchmarkLine = r.insights.find((i) => i.includes('industry benchmark'))!;

    assert.ok(benchmarkLine.includes('$1.34'), `expected wage-excluded benchmark, got: ${benchmarkLine}`);
    assert.ok(benchmarkLine.includes('driver wage excluded'));
    assert.ok(r.insights.some((i) => i.includes('counts your own labor as profit')));
  });

  it('uses the full benchmark when the fleet actually pays a wage', () => {
    const trucks = [
      makeTestTruck('930', {
        profile: { ...DEFAULT_PROFILE, driverPayMode: 'per-mile', driverCpm: 0.65 },
      }),
    ];
    const r = buildFleetReport(trucks, [], 'month', [], 3.78, anchor, []);
    const benchmarkLine = r.insights.find((i) => i.includes('industry benchmark'))!;

    assert.ok(benchmarkLine.includes('$2.27'), `expected full benchmark, got: ${benchmarkLine}`);
    assert.ok(!benchmarkLine.includes('driver wage excluded'));
    assert.ok(r.combined.driverCost > 0);
  });

  it('surfaces a seated truck with no driver in the insights', () => {
    const trucks = [makeTestTruck('910')];
    const r = buildFleetReport(trucks, [], 'month', [], 3.78, anchor, []);
    assert.ok(
      r.insights.some((i) => i.includes('no driver assigned')),
      'an empty truck should be called out',
    );
  });
});
