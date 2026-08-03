import { isRtl, localeFor, t, type Lang } from '../data/i18n';
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
 * email — how a dispatcher actually gets this to a driver at 0500.
 *
 * Translated into the driver's language. What stays untranslated is a decision,
 * not an oversight: place names, unit numbers, road designations (I-80), state
 * codes and NWS alert wording are left in English because the driver has to
 * match them against road signs, paperwork, and a weather radio. A translated
 * highway name is worse than no translation at all.
 */
export function driverBriefToText(b: DriverBrief, lang: Lang = 'en'): string {
  const d = t(lang);
  const locale = localeFor(lang);
  const rtl = isRtl(lang);

  const L: string[] = [];
  const hr = () => L.push('');
  const time = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  const num = (n: number) => n.toLocaleString(locale);

  /**
   * Column alignment only works in a left-to-right block. In Arabic the label
   * and value are separated with a colon instead — padded columns render as
   * ragged nonsense once the paragraph direction flips.
   */
  // Width is derived rather than hardcoded, so a longer translated label can
  // never collide with its own value.
  const labelWidth =
    Math.max(
      ...[d.distance, d.states, d.depart, d.eta, d.appointment, d.equipment, d.weight].map(
        (s) => s.length,
      ),
    ) + 2;
  const field = (label: string, value: string) =>
    rtl ? `${label}: ${value}` : `${label.padEnd(labelWidth)}${value}`;

  L.push(`${d.driverBrief} — ${d.risk[b.riskLevel]}`);
  L.push(`${b.origin} ← ${b.destination}`.replace('←', rtl ? '←' : '→'));
  if (b.unitNumber)
    L.push(`${b.unitNumber}${b.driverNames.length ? ` · ${b.driverNames.join(' / ')}` : ''}`);
  if (b.carrier) L.push(b.carrier + (b.dotNumber ? ` · USDOT ${b.dotNumber}` : ''));

  if (b.dispatchNotes.trim()) {
    hr();
    L.push(d.fromDispatch);
    L.push(b.dispatchNotes.trim());
  }

  hr();
  L.push(d.bottomLine);
  L.push(d.bottomLineText[b.riskLevel]);

  hr();
  L.push(d.theRun);
  L.push(
    field(
      d.distance,
      `${num(b.totalMiles)} mi${b.deadheadMiles ? ` (${num(b.deadheadMiles)} ${d.deadhead})` : ''}`,
    ),
  );
  L.push(field(d.states, b.states.join(' · ')));
  L.push(field(d.depart, time(b.departAt)));
  L.push(field(d.eta, time(b.eta)));
  if (b.deliverBy) {
    const slack = Math.abs(b.slackHours ?? 0).toFixed(1);
    L.push(
      field(
        d.appointment,
        `${time(b.deliverBy)} — ${
          b.legalOnTime ? `${slack} hr ${d.slack}` : `${d.lateBy} ${slack} hr — ${d.doNotRunIllegal}`
        }`,
      ),
    );
  }
  L.push(
    field(d.equipment, `${b.equipment}${b.reeferSetPointF !== null ? ` @ ${b.reeferSetPointF}F` : ''}`),
  );
  L.push(field(d.weight, `${num(b.grossWeightLbs)} lb`));
  if (b.hazmat) L.push(field(d.hazmat, b.hazmat));
  if (b.oversize) L.push(field(d.oversize, d.oversizeNote));

  hr();
  L.push(d.timeline);
  for (const s of b.schedule) {
    const kind = d.stopKind[s.kind] ?? s.kind.replace(/-/g, ' ');
    L.push(`  ${time(s.at)}  ${kind} — ${d.mile} ${num(s.atMile)}`);
  }
  for (const w of b.cycleWarnings) L.push(`  ! ${w}`);

  hr();
  L.push(d.fuel);
  for (const a of translateFuelAdvice(b, d, locale)) L.push(`  ${a}`);
  for (const s of b.fuel.byState) {
    const tag = s.cheapest ? `  <- ${d.fillHere}` : s.avoid ? `  <- ${d.expensive}` : '';
    L.push(`  ${s.state}  $${s.pricePerGal.toFixed(3)}${d.perGal}  (${num(s.miles)} mi)${tag}`);
  }

  const notable = b.weather.filter((p) => p.severity !== 'clear');
  if (notable.length) {
    hr();
    L.push(d.weather);
    for (const p of notable) {
      L.push(`  [${p.severity.toUpperCase()}] ${p.state} ${d.mile} ${num(p.atMile)} — ${p.summary}`);
      for (const a of p.alerts) L.push(`     ! ${a}`);
    }
  }

  if (b.incidents.length) {
    hr();
    L.push(`${d.traffic} (~${Math.round(b.totalDelayMinutes)} ${d.minutes})`);
    for (const i of b.incidents) {
      L.push(`  ${i.state} ${i.route} +${i.delayMinutes}m — ${i.description}`);
    }
  }

  const blocking = b.restrictions.filter((r) => r.blocking);
  const other = b.restrictions.filter((r) => !r.blocking);
  if (blocking.length || other.length) {
    hr();
    L.push(d.restrictions);
    for (const r of blocking) L.push(`  [${d.blocking}] ${r.state} — ${r.title}: ${r.detail}`);
    for (const r of other.slice(0, 8)) L.push(`  ${r.state} — ${r.title}`);
  }

  if (b.dispatchPhone) {
    hr();
    L.push(field(d.dispatch, `${b.dispatchName ? b.dispatchName + ' · ' : ''}${b.dispatchPhone}`));
  }

  if (b.containsMockData) {
    hr();
    L.push(d.modeledDataNote);
  }

  const text = L.join('\n');
  // U+202B starts a right-to-left embedding. Without it, a message app that
  // guesses direction from the first character renders the whole brief
  // left-to-right the moment a line begins with a state code or a digit.
  return rtl ? `‫${text}‬` : text;
}

/**
 * Rebuilds the fuel advice in the target language.
 *
 * The advice is regenerated from the plan's own numbers rather than translated
 * string-by-string — the English sentences are assembled at build time, so
 * there is nothing stable to key a lookup on.
 */
function translateFuelAdvice(
  b: DriverBrief,
  d: ReturnType<typeof t>,
  locale: string,
): string[] {
  const out: string[] = [];
  const num = (n: number) => n.toLocaleString(locale);

  const cheapest = b.fuel.byState.find((s) => s.cheapest);
  const dearest = b.fuel.byState.find((s) => s.avoid);

  if (cheapest) out.push(d.cheapestIs(cheapest.state, `$${cheapest.pricePerGal.toFixed(3)}`));
  if (dearest && cheapest) {
    out.push(
      d.costlierBy(dearest.state, `$${(dearest.pricePerGal - cheapest.pricePerGal).toFixed(2)}`),
    );
  }

  out.push(
    b.totalMiles > b.fuel.rangeMiles
      ? d.needAFill(num(b.totalMiles), num(b.fuel.rangeMiles))
      : d.oneTank(num(b.fuel.rangeMiles)),
  );
  out.push(d.pricesAreRegional);
  return out;
}
