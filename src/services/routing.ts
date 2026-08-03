import { haversineMiles, interpolate, nearestState } from '../data/geo';
import type { LatLng, Place, Route, RouteSegment, StateCode, TripInput } from '../types';

/**
 * Routing provider contract.
 *
 * Swap `MockRouting` for a real truck-legal router (HERE Routing v8 with
 * `transportMode=truck`, Trimble/PC*Miler, or Google Routes with truck
 * modifiers) by implementing this interface. Nothing else in the app changes.
 */
export interface RoutingProvider {
  readonly name: string;
  readonly live: boolean;
  route(input: TripInput): Promise<Route>;
}

/**
 * Real road miles run longer than the straight line. 1.18 is a good planning
 * factor for the US interstate network on long hauls.
 */
const CIRCUITY = 1.18;

/** How many sample points to walk when attributing miles to states. */
const SAMPLES_PER_LEG = 240;

/**
 * Effective toll cost per mile driven in each state, already discounted for the
 * fact that not every mile in a toll state is on a toll road. Five-axle rates.
 */
const TOLL_CPM: Partial<Record<StateCode, number>> = {
  PA: 0.22, NJ: 0.18, NY: 0.15, IL: 0.14, DE: 0.12, IN: 0.11, OH: 0.1,
  WV: 0.09, FL: 0.09, MD: 0.08, MA: 0.07, OK: 0.07, KS: 0.06, ME: 0.06,
  TX: 0.05, VA: 0.05, NH: 0.04, CO: 0.03, CA: 0.02, WA: 0.02,
};

function legSegments(from: LatLng, to: LatLng, startMile: number): RouteSegment[] {
  const legMiles = haversineMiles(from, to) * CIRCUITY;
  const out: RouteSegment[] = [];
  let current: StateCode | null = null;
  let runStart = 0;

  const push = (state: StateCode, fromT: number, toT: number) => {
    const miles = legMiles * (toT - fromT);
    if (miles < 1) return;
    out.push({
      state,
      miles,
      midpoint: interpolate(from, to, (fromT + toT) / 2),
      cumulativeMiles: startMile + legMiles * toT,
    });
  };

  for (let i = 0; i <= SAMPLES_PER_LEG; i++) {
    const t = i / SAMPLES_PER_LEG;
    const s = nearestState(interpolate(from, to, t));
    if (current === null) {
      current = s;
      runStart = t;
    } else if (s !== current) {
      push(current, runStart, t);
      current = s;
      runStart = t;
    }
  }
  if (current !== null) push(current, runStart, 1);
  return out;
}

/** Merges adjacent segments that landed in the same state. */
function coalesce(segments: RouteSegment[]): RouteSegment[] {
  const out: RouteSegment[] = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (prev && prev.state === seg.state) {
      prev.miles += seg.miles;
      prev.cumulativeMiles = seg.cumulativeMiles;
      prev.midpoint = seg.midpoint;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

export class MockRouting implements RoutingProvider {
  readonly name = 'Great-circle estimate (offline)';
  readonly live = false;

  async route(input: TripInput): Promise<Route> {
    const waypoints: Place[] = [input.origin, ...input.stops, input.destination];

    let segments: RouteSegment[] = [];
    let cumulative = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      segments = segments.concat(legSegments(a, b, cumulative));
      cumulative += haversineMiles(a, b) * CIRCUITY;
    }
    segments = coalesce(segments);

    const loadedMiles = segments.reduce((sum, s) => sum + s.miles, 0);
    const totalMiles = loadedMiles + input.deadheadMiles;

    const tollEstimate = segments.reduce(
      (sum, s) => sum + s.miles * (TOLL_CPM[s.state] ?? 0),
      0,
    );

    const states: StateCode[] = [];
    for (const s of segments) if (!states.includes(s.state)) states.push(s.state);

    return {
      totalMiles,
      driveHours: 0, // Filled by the HOS planner, which knows the truck's speed.
      segments,
      states,
      tollEstimate,
      truckLegal: false, // A straight-line estimate cannot promise truck-legal.
      provider: this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Live: HERE Routing v8 (truck-legal)
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.344;
const LB_PER_KG = 2.20462;

/** Maps the app's hazmat classes onto HERE's `shippedHazardousGoods` values. */
const HERE_HAZMAT: Record<string, string> = {
  '1-explosives': 'explosive',
  '2-gases': 'gas',
  '3-flammable-liquid': 'flammable',
  '4-flammable-solid': 'flammable',
  '5-oxidizer': 'organic',
  '6-toxic': 'poison',
  '7-radioactive': 'radioactive',
  '8-corrosive': 'corrosive',
  '9-misc': 'otherHazardous',
};

/**
 * Decodes HERE's flexible polyline into coordinates.
 *
 * Needed because the API returns per-state spans as *offsets into the
 * polyline*, not as coordinates. Without decoding there is no way to know
 * where in a state the truck actually is, and weather would have to be guessed
 * by interpolating a straight line — which on a route like I-80 through
 * Wyoming can land the lookup in the wrong state entirely.
 *
 * Format: a header (precision, third-dimension flags) followed by
 * varint-encoded zig-zag deltas. https://github.com/heremaps/flexible-polyline
 */
/** HERE's encoding alphabet. Index in this string is the 6-bit value. */
const FLEXPOLY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/**
 * Built from the alphabet rather than transcribed as a literal. A hand-copied
 * lookup table is easy to get subtly wrong and produces plausible-but-wrong
 * coordinates, which is the worst kind of bug here — every weather lookup
 * lands somewhere real, just not on the route.
 */
const FLEXPOLY_DECODE = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < FLEXPOLY_ALPHABET.length; i++) {
    table[FLEXPOLY_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export function decodeFlexiblePolyline(encoded: string): LatLng[] {
  let index = 0;

  /** Plain unsigned varint. The header words use this form. */
  const nextUnsigned = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (index >= encoded.length) return NaN;
      const code = FLEXPOLY_DECODE[encoded.charCodeAt(index++)] ?? -1;
      if (code < 0) return NaN;
      result |= (code & 0x1f) << shift;
      if ((code & 0x20) === 0) return result >>> 0;
      shift += 5;
    }
  };

  /**
   * Zig-zag varint. Only the coordinate deltas use this — applying it to the
   * header turns version 1 into -1 and the decode silently yields nothing.
   */
  const nextSigned = (): number => {
    const raw = nextUnsigned();
    if (Number.isNaN(raw)) return NaN;
    return raw & 1 ? ~(raw >>> 1) : raw >>> 1;
  };

  // The header is TWO unsigned varints: a version, then a metadata word
  // carrying precision and the third-dimension flags.
  const version = nextUnsigned();
  if (version !== 1) return [];

  const metadata = nextUnsigned();
  if (Number.isNaN(metadata)) return [];
  const precision = metadata & 15;
  const thirdDim = (metadata >> 4) & 7;
  const factor = 10 ** precision;

  const out: LatLng[] = [];
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    const dLat = nextSigned();
    const dLon = nextSigned();
    if (Number.isNaN(dLat) || Number.isNaN(dLon)) break;
    lat += dLat;
    lon += dLon;
    // Consume and discard elevation if the polyline carries a third dimension.
    if (thirdDim) nextSigned();
    out.push({ lat: lat / factor, lon: lon / factor });
  }
  return out;
}

type HereSpan = { offset: number; length?: number; stateCode?: string; countryCode?: string };
type HereSection = {
  summary?: { length?: number; duration?: number };
  polyline?: string;
  spans?: HereSpan[];
  tolls?: { fares?: { price?: { value?: number } }[] }[];
};

/**
 * Truck-legal routing from HERE.
 *
 * Unlike the great-circle estimate this respects height, weight, axle count and
 * hazmat restrictions — it will route a placarded load around the Eisenhower
 * Tunnel rather than through it, and it will not send an 80,000 lb truck over a
 * bridge posted for less.
 *
 * **The key belongs on the server, not in the app.** A mobile bundle ships to
 * devices and can be unpacked. Point `apiBase` at the extraction server (see
 * `server/`) with a `/route` endpoint that adds the key and proxies to HERE.
 * Passing a raw HERE key here works for a quick local test and must not ship.
 */
export class HereRouting implements RoutingProvider {
  readonly name = 'HERE Routing v8 (truck-legal)';
  readonly live = true;

  constructor(
    /** Server proxy base URL, or 'https://router.hereapi.com' for local testing. */
    private readonly apiBase: string,
    /** Only set this in a local test. Never ship a key in the app bundle. */
    private readonly apiKey?: string,
    private readonly timeoutMs = 15_000,
  ) {}

  private buildUrl(input: TripInput): string {
    const pt = (p: Place | LatLng) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    const params = new URLSearchParams();

    params.set('transportMode', 'truck');
    params.set('origin', pt(input.origin));
    params.set('destination', pt(input.destination));
    // summary gives distance and duration; spans give the per-state breakdown;
    // polyline lets us place weather lookups accurately; tolls gives real fares
    // instead of the per-mile estimate the offline model falls back to.
    params.set('return', 'summary,polyline,tolls');
    params.set('spans', 'length,stateCode,countryCode');

    // A loaded five-axle tractor-trailer at legal maximums, overridden by what
    // the driver actually entered.
    params.set('truck[grossWeight]', String(Math.round(input.grossWeightLbs / LB_PER_KG)));
    params.set('truck[height]', '412'); // 13'6" in cm
    params.set('truck[width]', '259'); // 8'6"
    params.set('truck[length]', '2200'); // 72'
    params.set('truck[axleCount]', '5');

    if (input.hazmat) {
      const good = HERE_HAZMAT[input.hazmat];
      if (good) params.set('truck[shippedHazardousGoods]', good);
    }

    for (const stop of input.stops) params.append('via', pt(stop));
    if (this.apiKey) params.set('apiKey', this.apiKey);

    const base = this.apiBase.replace(/\/$/, '');
    // Talking to HERE directly (local test) vs through the server proxy.
    const path = base.includes('hereapi.com') ? '/v8/routes' : '/route';
    return `${base}${path}?${params.toString()}`;
  }

  async route(input: TripInput): Promise<Route> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let data: { routes?: { sections?: HereSection[] }[]; notices?: { title?: string }[] };
    try {
      const res = await fetch(this.buildUrl(input), { signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HERE routing returned ${res.status}. ${body.slice(0, 160)}`);
      }
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }

    const sections = data.routes?.[0]?.sections;
    if (!sections?.length) {
      throw new Error(
        'HERE returned no route. Check the truck dimensions and that both ends are reachable by a commercial vehicle.',
      );
    }

    // --- Accumulate per-state segments across every section ------------------
    const segments: RouteSegment[] = [];
    let cumulativeMiles = 0;
    let tollTotal = 0;

    for (const section of sections) {
      const coords = section.polyline ? decodeFlexiblePolyline(section.polyline) : [];
      const spans = section.spans ?? [];

      for (const fare of section.tolls?.flatMap((t) => t.fares ?? []) ?? []) {
        tollTotal += fare.price?.value ?? 0;
      }

      for (const [i, span] of spans.entries()) {
        const miles = (span.length ?? 0) / METERS_PER_MILE;
        if (miles <= 0) continue;

        // A span covers polyline points [offset, nextOffset). Take the middle
        // one so the weather lookup lands inside the span, not on its border.
        const start = span.offset ?? 0;
        const end = spans[i + 1]?.offset ?? coords.length;
        const midpoint = coords[Math.floor((start + end) / 2)] ?? coords[start] ?? input.origin;

        cumulativeMiles += miles;

        // HERE gives state codes as ISO subdivisions, e.g. "US-TX".
        const state = (span.stateCode?.split('-').pop() ?? '').toUpperCase() as StateCode;
        if (!state) continue;

        const prev = segments[segments.length - 1];
        if (prev && prev.state === state) {
          // Merge consecutive spans in the same state so the brief lists each
          // state once rather than once per road segment.
          prev.miles += miles;
          prev.cumulativeMiles = cumulativeMiles;
          prev.midpoint = midpoint;
        } else {
          segments.push({ state, miles, midpoint, cumulativeMiles });
        }
      }
    }

    if (segments.length === 0) {
      throw new Error('HERE returned a route with no state spans. Request `spans=stateCode,length`.');
    }

    const loadedMiles = segments.reduce((sum, s) => sum + s.miles, 0);
    const driveSeconds = sections.reduce((sum, s) => sum + (s.summary?.duration ?? 0), 0);

    const states: StateCode[] = [];
    for (const s of segments) if (!states.includes(s.state)) states.push(s.state);

    return {
      totalMiles: loadedMiles + input.deadheadMiles,
      driveHours: driveSeconds / 3600,
      segments,
      states,
      tollEstimate: tollTotal,
      truckLegal: true,
      provider: this.name,
    };
  }
}
