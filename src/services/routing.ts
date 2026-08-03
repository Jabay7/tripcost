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

/**
 * Live truck-legal routing.
 *
 * Implementation sketch for HERE Routing v8:
 *
 *   GET https://router.hereapi.com/v8/routes
 *     ?transportMode=truck
 *     &origin={lat},{lon}&destination={lat},{lon}
 *     &via={lat},{lon}                       (repeat per stop)
 *     &truck[grossWeight]={kg}
 *     &truck[height]={cm}&truck[width]={cm}&truck[length]={cm}
 *     &truck[shippedHazardousGoods]=flammable   (maps from TripInput.hazmat)
 *     &return=summary,polyline,tolls
 *     &apiKey={key}
 *
 * The response carries per-country/state sections, toll totals and a polyline;
 * map `sections[].summary.length` into RouteSegment miles and set
 * `truckLegal: true`. Keep the key on the server proxy, never in the bundle.
 */
export class HereRouting implements RoutingProvider {
  readonly name = 'HERE Routing v8 (truck)';
  readonly live = true;

  constructor(private readonly apiBase: string) {}

  async route(_input: TripInput): Promise<Route> {
    throw new Error(
      'HereRouting is not wired yet. Set EXPO_PUBLIC_API_BASE and implement the fetch, ' +
        'or keep using MockRouting.',
    );
  }
}
