/**
 * End-to-end smoke check.
 *
 * Runs a realistic load through the whole pipeline and prints the brief the way
 * the app renders it, then produces a fleet report. Run with `npm run verify`.
 * Useful for eyeballing whether the numbers are sane after changing the model —
 * the unit tests prove the math holds together, this shows what it looks like.
 */
import { buildDriverBrief, driverBriefToText } from '../src/calc/driverBrief';
import { buildFleetReport } from '../src/calc/fleet';
import { DEFAULT_PROFILE } from '../src/data/defaults';
import { cityById } from '../src/data/geo';
import { withOptional } from '../src/data/optionalCosts';
import { buildTripBrief } from '../src/services';
import type { AddedCost, Driver, LedgerEntry, TripInput, Truck } from '../src/types';

const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const cents = (n: number) => `$${n.toFixed(3)}`;
const rule = (label = '') =>
  console.log(`\n${label ? `── ${label} ` : ''}${'─'.repeat(Math.max(0, 70 - label.length))}`);

async function main() {
  // A hard load: reefer, winter, mountains, tight appointment.
  const trip: TripInput = {
    origin: cityById('lar')!, // Laredo, TX — produce out of Mexico
    destination: cityById('chi')!,
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
    // The driver's answers on the Extras step: this receiver charges a lumper,
    // the trailer needs a washout, and it is January so chains are going.
    optionalCosts: withOptional({
      lumper: 320,
      washout: true,
      chains: true,
      'reserved-parking': true,
    }),
    deliverBy: '2026-01-16T14:00:00.000Z',
  };

  const unplanned: AddedCost[] = [
    {
      id: 'c1',
      label: 'Road service — drive tire',
      amount: 640,
      category: 'tire',
      note: 'Blowout on I-35 north of Waco.',
      outOfPocket: true,
      reimbursable: false,
      incurredAt: '2026-01-14T19:00:00.000Z',
    },
  ];

  const brief = await buildTripBrief(trip, DEFAULT_PROFILE, unplanned);
  const { cost, route, hos, fuel, risk, weather, traffic, restrictions } = brief;

  rule('TRIP BRIEF');
  console.log(`${trip.origin.name} → ${trip.destination.name}   (reefer @ ${trip.reeferSetPointF}°F)`);
  console.log(`\n  ${risk.level}  risk ${risk.score}/100`);
  console.log(`  ${risk.bottomLine}`);

  rule('ROUTE');
  console.log(`  Distance        ${Math.round(route.totalMiles).toLocaleString()} mi (${trip.deadheadMiles} deadhead)`);
  console.log(`  States          ${route.states.join(' · ')}`);
  console.log(`  Drive time      ${hos.drivingHours.toFixed(1)} hr`);
  console.log(`  Elapsed         ${hos.totalElapsedHours.toFixed(1)} hr · ${hos.nightsOut} night(s) out`);
  console.log(`  ETA             ${new Date(hos.eta).toUTCString()}`);
  console.log(`  Appointment     ${hos.legalOnTime ? `MET with ${hos.slackHours.toFixed(1)} hr slack` : `LATE by ${Math.abs(hos.slackHours).toFixed(1)} hr`}`);
  console.log(`  Tolls           ${usd(route.tollEstimate)}`);

  rule('FUEL');
  console.log(`  Blended         ${cents(fuel.blendedPricePerGal)}/gal`);
  console.log(`  Fill in         ${fuel.cheapestState} @ ${cents(fuel.cheapestPrice)}/gal`);

  rule('TIMELINE');
  for (const s of hos.stops) {
    console.log(
      `  ${new Date(s.at).toISOString().slice(5, 16).replace('T', ' ')}  ` +
        `${s.kind.padEnd(13)} mile ${String(s.atMile).padStart(5)}  ${s.durationHours}h`,
    );
  }

  rule('HAZARDS');
  const notable = weather.points.filter((p) => p.severity !== 'clear');
  if (notable.length === 0) console.log('  Weather: clear along the route.');
  for (const p of notable) {
    console.log(`  [${p.severity.toUpperCase().padEnd(8)}] ${p.state} mile ${p.atMile} — ${p.summary}`);
    for (const a of p.alerts) console.log(`             ⚠ ${a}`);
  }
  for (const i of traffic.incidents) {
    console.log(`  [TRAFFIC ] ${i.state} ${i.route} +${i.delayMinutes}m — ${i.description}`);
  }
  for (const r of restrictions.restrictions.filter((x) => x.blocking || x.costUsd > 0)) {
    console.log(`  [${r.blocking ? 'BLOCKING' : 'COST    '}] ${r.state} — ${r.title}`);
  }

  rule('COST');
  for (const line of [...cost.lines].sort((a, b) => b.amount - a.amount)) {
    const tags = [line.outOfPocket ? 'OOP' : '', line.reimbursable ? 'REIMB' : ''].filter(Boolean).join(',');
    console.log(`  ${line.label.padEnd(26)} ${usd(line.amount).padStart(9)}  ${tags}`);
  }
  console.log(`  ${'─'.repeat(26)} ${'─'.repeat(9)}`);
  console.log(`  ${'TOTAL COST'.padEnd(26)} ${usd(cost.totalCost).padStart(9)}`);

  rule('REVENUE');
  for (const r of cost.revenue) {
    console.log(`  ${r.label.padEnd(30)} ${usd(r.amount).padStart(9)}${r.contingent ? '  (not committed)' : ''}`);
  }

  rule('BOTTOM LINE');
  console.log(`  Committed revenue   ${usd(cost.committedRevenue).padStart(9)}`);
  console.log(`  Total cost          ${usd(cost.totalCost).padStart(9)}`);
  console.log(`  NET PROFIT          ${usd(cost.netProfit).padStart(9)}   (${cost.marginPercent.toFixed(1)}% margin)`);
  console.log(`  Profit per day      ${usd(cost.profitPerDay).padStart(9)}`);
  console.log(`  All-in rate         ${cents(cost.allInRatePerMile)}/mi   break-even ${cents(cost.breakEvenRatePerMile)}/mi`);
  console.log(`  CASH TO FLOAT       ${usd(cost.cashToFloat).padStart(9)}   out of pocket before settlement`);

  // -------------------------------------------------------------------------
  // Fleet
  // -------------------------------------------------------------------------
  const mkTruck = (id: string, over: Partial<Truck>): Truck => ({
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
  });

  const mkDriver = (id: string, name: string, truckId: string | null): Driver => ({
    id,
    firstName: name.split(' ')[0],
    lastName: name.split(' ')[1] ?? '',
    phone: '',
    email: '',
    cdlNumber: '',
    cdlState: 'TX',
    cdlClass: 'A',
    cdlExpires: '2029-06-01T00:00:00.000Z',
    endorsements: [],
    medicalCardExpires: id === 'd2' ? '2026-02-01T00:00:00.000Z' : '2028-01-01T00:00:00.000Z',
    hireDate: '2024-01-01T00:00:00.000Z',
    status: 'active',
    assignedTruckId: truckId,
    payMode: 'per-mile',
    payRate: 0.65,
    hosCycle: 70,
    notes: '',
  });

  const trucks = [
    mkTruck('118', { profile: { ...DEFAULT_PROFILE, mpg: 6.5 } }),
    mkTruck('204', {
      year: 2019,
      make: 'Peterbilt',
      model: '579',
      plannedMilesPerDay: 470,
      profile: { ...DEFAULT_PROFILE, mpg: 6.1, maintenanceCpm: 0.26, truckPaymentMo: 1750 },
    }),
    mkTruck('307', {
      year: 2023,
      make: 'Kenworth',
      model: 'T680',
      plannedMilesPerDay: 540,
      targetRatePerMile: 2.72,
      profile: { ...DEFAULT_PROFILE, mpg: 7.1, maintenanceCpm: 0.14, truckPaymentMo: 2650 },
    }),
  ];

  const drivers = [
    mkDriver('d1', 'Javier Alvarez', '118'),
    mkDriver('d2', 'Rachel Okafor', '204'),
    mkDriver('d3', 'Darius Whitfield', '307'),
  ];

  const anchor = new Date('2026-01-20T12:00:00.000Z');
  const ledger: LedgerEntry[] = [
    {
      id: 'l1',
      truckId: '204',
      date: '2026-01-14T00:00:00.000Z',
      kind: 'expense',
      category: 'tow',
      label: 'Heavy-duty tow',
      amount: 1150,
      miles: 0,
      note: 'Air system failure.',
    },
    {
      id: 'l2',
      truckId: '204',
      date: '2026-01-17T00:00:00.000Z',
      kind: 'expense',
      category: 'tire',
      label: 'Road service — drive tire',
      amount: 640,
      miles: 0,
      note: '',
    },
  ];

  const scopes: { label: string; selection: string[] }[] = [
    { label: 'WHOLE FLEET', selection: [] },
    { label: 'SELECTED: 204 + 307', selection: ['204', '307'] },
  ];

  for (const { label, selection } of scopes) {
    const rep = buildFleetReport(trucks, ledger, 'month', selection, 3.78, anchor, drivers);
    const c = rep.combined;

    rule(`FLEET — ${label} (last 30 days)`);
    console.log(`  Total cost      ${usd(c.totalCost)}   ${usd(c.costPerDay)}/day   ${cents(c.costPerMile)}/mi`);
    console.log(`  Miles           ${c.miles.toLocaleString()}`);
    console.log(`  Revenue         ${usd(c.revenue)}   net ${usd(c.netProfit)}   OR ${c.operatingRatio.toFixed(1)}%`);
    if (selection.length > 0) {
      console.log(`  Share of fleet  ${rep.shareOfFleetCost.toFixed(1)}% of ${usd(rep.fleetTotalCost)}`);
    }
    console.log('\n  Per truck:');
    for (const t of [...rep.perTruck].sort((a, b) => b.costPerMile - a.costPerMile)) {
      console.log(
        `    ${t.title.padEnd(12)} ${usd(t.totalCost).padStart(9)}  ${cents(t.costPerMile)}/mi  ` +
          `net ${usd(t.netProfit).padStart(8)}  OR ${t.operatingRatio.toFixed(1)}%` +
          (t.incidentCost > 0 ? `  [${t.incidentCount} incident(s) ${usd(t.incidentCost)}]` : ''),
      );
    }
    console.log('\n  Per driver:');
    for (const d of rep.perDriver) {
      console.log(
        `    ${d.name.padEnd(20)} ${d.truckLabel.padEnd(10)} ${usd(d.totalCost).padStart(9)}  ${cents(d.costPerMile)}/mi`,
      );
    }
    if (rep.complianceAlerts.length > 0) {
      console.log('\n  Compliance:');
      for (const a of rep.complianceAlerts) {
        console.log(`    [${a.severity.toUpperCase().padEnd(8)}] ${a.driverName} — ${a.message}`);
      }
    }
    console.log('\n  Read on the numbers:');
    for (const i of rep.insights) console.log(`    ▸ ${i}`);
  }

  // -------------------------------------------------------------------------
  // Driver copy — the same trip with every financial figure removed
  // -------------------------------------------------------------------------
  rule("DRIVER COPY (what gets sent to the driver)");
  const driverCopy = buildDriverBrief(brief, {
    fleet: { company: { name: 'Sample Carrier', dotNumber: '1234567', mcNumber: '', contactName: 'Dispatch', contactPhone: '(555) 555-0100', contactEmail: '' }, trucks, drivers },
    truck: trucks[0],
    drivers: [drivers[0]],
    dispatchNotes: 'Lumper is cash only. Call before you arrive.',
  });
  console.log(driverBriefToText(driverCopy));

  rule('LEAK CHECK');
  const payload = JSON.stringify(driverCopy) + driverBriefToText(driverCopy);
  const secrets: [string, number][] = [
    ['total cost', cost.totalCost],
    ['revenue', cost.committedRevenue],
    ['net profit', cost.netProfit],
    ['cash to float', cost.cashToFloat],
  ];
  let leaked = false;
  for (const [label, value] of secrets) {
    const whole = String(Math.round(value));
    const found = whole.length >= 3 && payload.includes(whole);
    if (found) leaked = true;
    console.log(`  ${found ? 'LEAKED ' : 'clean  '} ${label.padEnd(14)} ${whole}`);
  }
  console.log(`  ${leaked ? '*** DRIVER COPY LEAKS FINANCIALS ***' : 'No dispatch financials reached the driver copy.'}`);

  rule('DATA SOURCES');
  for (const s of brief.sources) {
    console.log(`  ${s.service.padEnd(14)} ${(s.live ? 'LIVE' : 'OFFLINE').padEnd(8)} ${s.provider}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
