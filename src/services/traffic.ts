import type { Incident, Route, StateCode, TrafficReport } from '../types';

export interface TrafficProvider {
  readonly name: string;
  readonly live: boolean;
  incidents(route: Route): Promise<TrafficReport>;
}

function hash01(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Corridors where a truck realistically loses time, by state. */
const CHOKEPOINTS: Partial<Record<StateCode, { route: string; where: string }[]>> = {
  IL: [{ route: 'I-294 / I-80', where: 'Chicago southwest belt' }, { route: 'I-90', where: 'Jane Byrne Interchange' }],
  CA: [{ route: 'I-5', where: 'Grapevine / Tejon Pass' }, { route: 'I-710', where: 'Long Beach port corridor' }],
  TX: [{ route: 'I-35', where: 'Austin–San Antonio corridor' }, { route: 'I-45', where: 'North Houston' }],
  PA: [{ route: 'I-76', where: 'Pennsylvania Turnpike, Breezewood' }, { route: 'I-78', where: 'Lehigh Valley' }],
  NJ: [{ route: 'I-95 NJ Turnpike', where: 'Newark interchange' }],
  NY: [{ route: 'I-95', where: 'George Washington Bridge approach' }],
  GA: [{ route: 'I-285', where: 'Atlanta perimeter' }, { route: 'I-75', where: 'Downtown connector' }],
  TN: [{ route: 'I-24', where: 'Monteagle grade' }, { route: 'I-40', where: 'Nashville core' }],
  CO: [{ route: 'I-70', where: 'Eisenhower Tunnel approach' }],
  WY: [{ route: 'I-80', where: 'Elk Mountain corridor' }],
  OH: [{ route: 'I-71', where: 'Columbus split' }],
  VA: [{ route: 'I-81', where: 'Roanoke to Winchester' }],
  WA: [{ route: 'I-90', where: 'Snoqualmie Pass' }],
  AZ: [{ route: 'I-10', where: 'Phoenix metro' }],
  MO: [{ route: 'I-70', where: 'St. Louis river crossing' }],
  IN: [{ route: 'I-65', where: 'Indianapolis north split' }],
  MI: [{ route: 'I-94', where: 'Detroit industrial corridor' }],
  FL: [{ route: 'I-4', where: 'Orlando corridor' }],
  NC: [{ route: 'I-77', where: 'Charlotte north' }],
  UT: [{ route: 'I-80', where: 'Parleys Canyon' }],
};

export class MockTraffic implements TrafficProvider {
  readonly name = 'Corridor congestion model (offline)';
  readonly live = false;

  async incidents(route: Route): Promise<TrafficReport> {
    const incidents: Incident[] = [];

    for (const seg of route.segments) {
      const spots = CHOKEPOINTS[seg.state];
      if (!spots) continue;

      for (const [i, spot] of spots.entries()) {
        const roll = hash01(seg.state, spot.route, i, Math.round(seg.cumulativeMiles));
        // Only surface a chokepoint when the route spends real miles in the state.
        if (seg.miles < 60 || roll > 0.55) continue;

        const kind: Incident['kind'] =
          roll < 0.12 ? 'accident' : roll < 0.28 ? 'construction' : roll < 0.34 ? 'closure' : 'congestion';

        const delayMinutes =
          kind === 'closure' ? 45 + Math.round(roll * 120)
          : kind === 'accident' ? 20 + Math.round(roll * 70)
          : kind === 'construction' ? 10 + Math.round(roll * 30)
          : 8 + Math.round(roll * 25);

        const severity: Incident['severity'] =
          delayMinutes >= 60 ? 'high' : delayMinutes >= 25 ? 'medium' : 'low';

        const description =
          kind === 'accident' ? `Crash with lane blockage near ${spot.where}.`
          : kind === 'construction' ? `Active work zone near ${spot.where}, lane restrictions.`
          : kind === 'closure' ? `Full closure reported near ${spot.where}. Detour in effect.`
          : `Heavy recurring congestion through ${spot.where}.`;

        incidents.push({
          kind,
          state: seg.state,
          atMile: Math.round(seg.cumulativeMiles - seg.miles / 2),
          route: spot.route,
          description,
          delayMinutes,
          severity,
        });
      }
    }

    incidents.sort((a, b) => a.atMile - b.atMile);
    return {
      incidents,
      totalDelayMinutes: incidents.reduce((s, i) => s + i.delayMinutes, 0),
      provider: this.name,
    };
  }
}

/**
 * Live incidents and closures.
 *
 * Two good sources, usually combined:
 *
 *  - HERE Traffic Incidents v7:
 *      GET https://data.traffic.hereapi.com/v7/incidents
 *        ?in=corridor:{polyline};r=1000&locationReferencing=shape&apiKey={key}
 *      Returns type (accident, construction, roadClosure), criticality and a
 *      time window — map criticality onto Incident.severity.
 *
 *  - State DOT 511 feeds for closures and chain controls. Most publish an open
 *    JSON or WZDx feed (e.g. Wyoming, Colorado and Washington all do), which is
 *    where real winter road closures show up first.
 *
 * FMCSA's national closure picture is thin; state 511 is the authority.
 */
export class HereTraffic implements TrafficProvider {
  readonly name = 'HERE Traffic Incidents v7';
  readonly live = true;

  constructor(private readonly apiBase: string) {}

  async incidents(): Promise<TrafficReport> {
    throw new Error('HereTraffic is not wired yet. Implement the incidents fetch.');
  }
}
