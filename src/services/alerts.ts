import { haversineMiles } from '../data/geo';
import type { LatLng, Route } from '../types';

/**
 * Live weather alerts while the truck is moving.
 *
 * The brief tells a driver what to expect before they roll. This tells them
 * what changed after. A blizzard warning issued three hours into a run is the
 * one that actually matters, and it is exactly the one a pre-trip brief cannot
 * contain.
 *
 * Two things this deliberately does:
 *
 *  - **Looks ahead, not just underfoot.** Polling only the truck's current
 *    position tells a driver about weather they are already in, which is late.
 *    It samples points along the road ahead as well and reports how far out
 *    each alert is, so a warning arrives with enough distance to do something
 *    about it — stop, fuel early, or take the other route.
 *
 *  - **Filters to what stops a truck.** NWS issues alerts for everything from
 *    rip currents to air quality. A driver who gets pinged for a beach hazard
 *    stops reading the pings. Only events that change how a truck runs are
 *    surfaced by default.
 */

export type RoadAlert = {
  /** NWS alert id — stable, used to avoid announcing the same alert twice. */
  id: string;
  event: string;
  headline: string;
  description: string;
  /** NWS severity: Extreme, Severe, Moderate, Minor, Unknown. */
  severity: string;
  /** How urgent NWS considers it. */
  urgency: string;
  areaDesc: string;
  effective: string;
  expires: string;
  /** Miles ahead along the route where this alert was found. 0 = here. */
  milesAhead: number;
  /** True when this one is worth interrupting the driver for. */
  critical: boolean;
};

/**
 * Events that change how a truck runs. Anything else is noise to a driver.
 * Matched case-insensitively against the NWS `event` field.
 */
const TRUCKING_RELEVANT = [
  'wind', 'blizzard', 'winter', 'snow', 'ice', 'ic', 'freez', 'sleet',
  'tornado', 'severe thunderstorm', 'flood', 'dust', 'fog', 'visibility',
  'hurricane', 'tropical storm', 'wind chill', 'extreme cold', 'avalanche',
];

/** The subset worth a notification rather than a line on a list. */
const CRITICAL_EVENTS = [
  'blizzard', 'tornado', 'ice storm', 'high wind warning', 'hurricane',
  'winter storm warning', 'dust storm', 'flash flood',
];

function isRelevant(event: string): boolean {
  const e = event.toLowerCase();
  return TRUCKING_RELEVANT.some((k) => e.includes(k));
}

function isCritical(event: string, severity: string): boolean {
  const e = event.toLowerCase();
  if (CRITICAL_EVENTS.some((k) => e.includes(k))) return true;
  // A warning is actionable; a watch or advisory usually is not.
  return /warning/.test(e) && /extreme|severe/i.test(severity);
}

type NwsAlertFeature = {
  properties?: {
    id?: string;
    event?: string;
    headline?: string;
    description?: string;
    severity?: string;
    urgency?: string;
    areaDesc?: string;
    effective?: string;
    expires?: string;
  };
};

export interface AlertProvider {
  readonly name: string;
  /**
   * Alerts for the driver's position and the road ahead.
   * @param lookAheadMiles how far up the route to check. ~250 mi is about four
   *        hours of driving, which is the horizon a driver can still act on.
   */
  check(position: LatLng, route: Route | null, lookAheadMiles?: number): Promise<RoadAlert[]>;
}

export class NwsAlerts implements AlertProvider {
  readonly name = 'National Weather Service alerts';

  constructor(
    private readonly userAgent: string,
    private readonly timeoutMs = 8000,
  ) {}

  private async fetchAt(p: LatLng): Promise<NwsAlertFeature[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(
        `https://api.weather.gov/alerts/active?point=${p.lat.toFixed(4)},${p.lon.toFixed(4)}`,
        {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/geo+json' },
          signal: controller.signal,
        },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { features?: NwsAlertFeature[] };
      return data.features ?? [];
    } catch {
      // A dropped cell signal is normal in this app's environment. Return
      // nothing and let the next poll pick it up rather than surfacing an
      // error the driver can do nothing about.
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Sample points to check: where the truck is, plus a few spread up the road.
   * NWS alerts are polygon-based, so sampling every segment midpoint would be
   * both slow and redundant — a handful of points across the look-ahead window
   * catches the same warnings.
   */
  private samplePoints(position: LatLng, route: Route | null, lookAheadMiles: number) {
    const points: { p: LatLng; milesAhead: number }[] = [{ p: position, milesAhead: 0 }];
    if (!route) return points;

    // Find where on the route the truck currently is, by nearest segment.
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (const [i, seg] of route.segments.entries()) {
      const d = haversineMiles(position, seg.midpoint);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    const currentMile = route.segments[nearestIdx]?.cumulativeMiles ?? 0;
    for (const seg of route.segments.slice(nearestIdx + 1)) {
      const ahead = seg.cumulativeMiles - currentMile;
      if (ahead <= 0 || ahead > lookAheadMiles) continue;
      points.push({ p: seg.midpoint, milesAhead: Math.round(ahead) });
      if (points.length >= 5) break; // Keep the poll cheap on cell data.
    }
    return points;
  }

  async check(position: LatLng, route: Route | null, lookAheadMiles = 250): Promise<RoadAlert[]> {
    const points = this.samplePoints(position, route, lookAheadMiles);
    const results = await Promise.all(points.map((s) => this.fetchAt(s.p)));

    // Keep the closest occurrence of each alert — an alert covering several
    // sample points should be reported at the nearest one.
    const byId = new Map<string, RoadAlert>();

    for (const [i, features] of results.entries()) {
      const milesAhead = points[i].milesAhead;
      for (const f of features) {
        const p = f.properties;
        if (!p?.id || !p.event) continue;
        if (!isRelevant(p.event)) continue;

        const existing = byId.get(p.id);
        if (existing && existing.milesAhead <= milesAhead) continue;

        byId.set(p.id, {
          id: p.id,
          event: p.event,
          headline: p.headline ?? p.event,
          description: (p.description ?? '').slice(0, 600),
          severity: p.severity ?? 'Unknown',
          urgency: p.urgency ?? 'Unknown',
          areaDesc: p.areaDesc ?? '',
          effective: p.effective ?? '',
          expires: p.expires ?? '',
          milesAhead,
          critical: isCritical(p.event, p.severity ?? ''),
        });
      }
    }

    // Nearest first — that is the order a driver needs them in.
    return [...byId.values()].sort((a, b) => a.milesAhead - b.milesAhead);
  }
}

/**
 * Tracks which alerts have already been announced, so a driver is interrupted
 * once per alert rather than on every poll.
 *
 * Kept separate from the provider because "what is active" and "what has this
 * driver already seen" are different questions, and only the second one needs
 * to survive a screen re-render.
 */
export class AlertSeenSet {
  private seen = new Set<string>();

  /** Returns only the alerts not previously announced, and marks them seen. */
  takeNew(alerts: RoadAlert[]): RoadAlert[] {
    const fresh = alerts.filter((a) => !this.seen.has(a.id));
    for (const a of fresh) this.seen.add(a.id);
    return fresh;
  }

  /** Drop ids that are no longer active, so a re-issued alert announces again. */
  prune(active: RoadAlert[]) {
    const live = new Set(active.map((a) => a.id));
    for (const id of this.seen) if (!live.has(id)) this.seen.delete(id);
  }

  get size() {
    return this.seen.size;
  }
}
