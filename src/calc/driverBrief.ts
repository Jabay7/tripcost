import { STATES } from '../data/states';
import type {
  Driver,
  DriverBrief,
  DriverFuelPlan,
  Fleet,
  HosStop,
  TripBrief,
  Truck,
} from '../types';

/**
 * The driver's copy of the brief.
 *
 * A dispatcher needs to know whether a load pays. A driver needs to know what
 * the road is going to do to them. Those are different documents, and mixing
 * them is how carriers end up leaking their rate structure to every driver who
 * screenshots a dispatch text.
 *
 * The separation here is structural, not cosmetic. This function builds a new
 * object containing only operational fields — it does not take a `TripBrief`
 * and hide parts of it behind a flag. Nothing downstream can accidentally
 * render a rate, a margin, or a cost per mile, because those values are not in
 * the object at all. A test asserts that the serialized brief contains none of
 * the trip's money figures.
 *
 * Fuel is the one place money legitimately appears, and only as price per
 * gallon by state. That is a fuel-stop instruction, not a financial disclosure:
 * a driver told to fill in Texas needs to know why. The total fuel spend, and
 * what it does to the load's margin, stay on the dispatch side.
 */
export function buildDriverBrief(
  brief: TripBrief,
  opts: {
    fleet: Fleet;
    truck: Truck | null;
    drivers: Driver[];
    /** Free-text instructions from dispatch. Shown at the top of the brief. */
    dispatchNotes?: string;
  },
): DriverBrief {
  const { input, route, fuel, weather, traffic, restrictions, hos, risk, profile } = brief;
  const { fleet, truck, drivers, dispatchNotes } = opts;

  // --- Fuel plan ----------------------------------------------------------
  // Range on a full tank, at this truck's real economy. This is what decides
  // whether "fill in Texas" is actually possible or just good advice.
  const rangeMiles = profile.tankGallons * profile.mpg;

  const byPrice = [...fuel.byState].sort((a, b) => a.pricePerGal - b.pricePerGal);
  const cheapest = byPrice[0];
  const dearest = byPrice[byPrice.length - 1];

  const plannedStops = hos.stops
    .filter((s) => s.kind === 'fuel')
    .map((s: HosStop) => ({ atMile: s.atMile, at: s.at }));

  const fuelPlan: DriverFuelPlan = {
    rangeMiles: Math.round(rangeMiles),
    tankGallons: profile.tankGallons,
    mpg: profile.mpg,
    byState: byPrice.map((q) => ({
      state: q.state,
      stateName: STATES[q.state]?.name ?? q.state,
      pricePerGal: q.pricePerGal,
      miles: Math.round(q.miles),
      cheapest: q.state === cheapest?.state,
      avoid:
        // Worth calling out only when the spread is big enough to be worth
        // planning around — a couple of cents is noise.
        dearest !== undefined &&
        cheapest !== undefined &&
        dearest.pricePerGal - cheapest.pricePerGal > 0.3 &&
        q.state === dearest.state,
    })),
    plannedStops,
    advice: buildFuelAdvice(cheapest?.state, cheapest?.pricePerGal, dearest, rangeMiles, route.totalMiles),
  };

  // --- Identity -----------------------------------------------------------
  const assigned = truck ? drivers.filter((d) => d.assignedTruckId === truck.id) : [];

  return {
    generatedAt: new Date().toISOString(),
    carrier: fleet.company.name,
    dotNumber: fleet.company.dotNumber,
    dispatchPhone: fleet.company.contactPhone,
    dispatchName: fleet.company.contactName,
    unitNumber: truck?.unitNumber ?? '',
    driverNames: assigned.map((d) => `${d.firstName} ${d.lastName}`.trim()).filter(Boolean),
    dispatchNotes: dispatchNotes ?? '',

    // --- Mission ----------------------------------------------------------
    origin: input.origin.name,
    destination: input.destination.name,
    stops: input.stops.map((s) => s.name),
    totalMiles: Math.round(route.totalMiles),
    deadheadMiles: Math.round(input.deadheadMiles),
    states: route.states,
    equipment: input.equipment,
    grossWeightLbs: input.grossWeightLbs,
    hazmat: input.hazmat,
    reeferSetPointF: input.reeferSetPointF,
    oversize: input.oversize,

    // --- Timeline ---------------------------------------------------------
    departAt: input.departAt,
    eta: hos.eta,
    deliverBy: input.deliverBy,
    legalOnTime: hos.legalOnTime,
    slackHours: Number.isFinite(hos.slackHours) ? hos.slackHours : null,
    drivingHours: hos.drivingHours,
    totalElapsedHours: hos.totalElapsedHours,
    tripDays: hos.tripDays,
    nightsOut: hos.nightsOut,
    schedule: hos.stops,
    cycleWarnings: hos.cycleWarnings,

    // --- What the road will do --------------------------------------------
    fuel: fuelPlan,
    weather: weather.points,
    worstWeather: weather.worst,
    incidents: traffic.incidents,
    totalDelayMinutes: traffic.totalDelayMinutes,
    restrictions: restrictions.restrictions,

    // --- Go / no-go --------------------------------------------------------
    riskLevel: risk.level,
    riskScore: risk.score,
    riskFactors: risk.factors,
    bottomLine: risk.bottomLine,

    // --- Provenance --------------------------------------------------------
    sources: brief.sources,
    containsMockData: brief.containsMockData,
  };
}

function buildFuelAdvice(
  cheapestState: string | undefined,
  cheapestPrice: number | undefined,
  dearest: { state: string; pricePerGal: number } | undefined,
  rangeMiles: number,
  totalMiles: number,
): string[] {
  const out: string[] = [];

  if (cheapestState && cheapestPrice !== undefined) {
    out.push(`Cheapest diesel on this route is ${cheapestState} at $${cheapestPrice.toFixed(3)}/gal. Fill there.`);
  }
  if (dearest && cheapestPrice !== undefined && dearest.pricePerGal - cheapestPrice > 0.3) {
    out.push(
      `${dearest.state} runs $${(dearest.pricePerGal - cheapestPrice).toFixed(2)}/gal higher — buy only what you need to get through it.`,
    );
  }

  if (totalMiles > rangeMiles) {
    out.push(
      `This run is ${Math.round(totalMiles).toLocaleString()} mi and your range on a full tank is about ${Math.round(rangeMiles).toLocaleString()} mi. You will need at least one fill.`,
    );
  } else {
    out.push(
      `Your range on a full tank is about ${Math.round(rangeMiles).toLocaleString()} mi, so this run can be made on one tank if you leave full.`,
    );
  }

  out.push('Prices are regional averages, not per-station. Check your fuel network app before pulling in.');
  return out;
}

// ---------------------------------------------------------------------------

/**
 * Renders the driver brief as plain text for sharing over SMS, WhatsApp or
 * email — how a dispatcher actually gets this to a driver at 0500. Written to
 * be readable on a phone screen without formatting support.
 */
export function driverBriefToText(b: DriverBrief): string {
  const L: string[] = [];
  const hr = () => L.push('');
  const time = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  L.push(`DRIVER BRIEF — ${b.riskLevel}`);
  L.push(`${b.origin} -> ${b.destination}`);
  if (b.unitNumber) L.push(`Unit ${b.unitNumber}${b.driverNames.length ? ` · ${b.driverNames.join(' / ')}` : ''}`);
  if (b.carrier) L.push(b.carrier + (b.dotNumber ? ` · USDOT ${b.dotNumber}` : ''));

  if (b.dispatchNotes.trim()) {
    hr();
    L.push('FROM DISPATCH');
    L.push(b.dispatchNotes.trim());
  }

  hr();
  L.push('BOTTOM LINE');
  L.push(b.bottomLine);

  hr();
  L.push('THE RUN');
  L.push(`Distance   ${b.totalMiles.toLocaleString()} mi${b.deadheadMiles ? ` (${b.deadheadMiles} deadhead)` : ''}`);
  L.push(`States     ${b.states.join(' · ')}`);
  L.push(`Depart     ${time(b.departAt)}`);
  L.push(`ETA        ${time(b.eta)}`);
  if (b.deliverBy) {
    L.push(
      `Appt       ${time(b.deliverBy)} — ${
        b.legalOnTime
          ? `${(b.slackHours ?? 0).toFixed(1)} hr slack`
          : `LATE by ${Math.abs(b.slackHours ?? 0).toFixed(1)} hr, DO NOT RUN ILLEGAL`
      }`,
    );
  }
  L.push(`Equipment  ${b.equipment}${b.reeferSetPointF !== null ? ` @ ${b.reeferSetPointF}F` : ''}`);
  L.push(`Weight     ${b.grossWeightLbs.toLocaleString()} lb`);
  if (b.hazmat) L.push(`HAZMAT     ${b.hazmat}`);
  if (b.oversize) L.push('OVERSIZE   permits and escort required');

  hr();
  L.push('TIMELINE');
  for (const s of b.schedule) {
    L.push(`  ${time(s.at)}  ${s.kind.replace(/-/g, ' ')} — mile ${s.atMile.toLocaleString()}`);
  }
  for (const w of b.cycleWarnings) L.push(`  ! ${w}`);

  hr();
  L.push('FUEL');
  for (const a of b.fuel.advice) L.push(`  ${a}`);
  for (const s of b.fuel.byState) {
    const tag = s.cheapest ? '  <- FILL HERE' : s.avoid ? '  <- expensive' : '';
    L.push(`  ${s.state}  $${s.pricePerGal.toFixed(3)}/gal  (${s.miles} mi)${tag}`);
  }

  const notable = b.weather.filter((p) => p.severity !== 'clear');
  if (notable.length) {
    hr();
    L.push('WEATHER');
    for (const p of notable) {
      L.push(`  [${p.severity.toUpperCase()}] ${p.state} mile ${p.atMile.toLocaleString()} — ${p.summary}`);
      for (const a of p.alerts) L.push(`     ! ${a}`);
    }
  }

  if (b.incidents.length) {
    hr();
    L.push(`TRAFFIC (~${Math.round(b.totalDelayMinutes)} min)`);
    for (const i of b.incidents) L.push(`  ${i.state} ${i.route} +${i.delayMinutes}m — ${i.description}`);
  }

  const blocking = b.restrictions.filter((r) => r.blocking);
  const other = b.restrictions.filter((r) => !r.blocking);
  if (blocking.length || other.length) {
    hr();
    L.push('RESTRICTIONS');
    for (const r of blocking) L.push(`  [BLOCKING] ${r.state} — ${r.title}: ${r.detail}`);
    for (const r of other.slice(0, 8)) L.push(`  ${r.state} — ${r.title}`);
  }

  if (b.dispatchPhone) {
    hr();
    L.push(`DISPATCH   ${b.dispatchName ? b.dispatchName + ' · ' : ''}${b.dispatchPhone}`);
  }

  if (b.containsMockData) {
    hr();
    L.push('NOTE: parts of this brief use modeled data, not live feeds. Verify before you roll.');
  }

  return L.join('\n');
}
