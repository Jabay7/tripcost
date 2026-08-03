import type {
  HosPlan,
  RestrictionReport,
  RiskAssessment,
  RiskFactor,
  Route,
  TrafficReport,
  TripInput,
  WeatherReport,
} from '../types';

/**
 * Scores a trip the way a convoy brief scores a route: not "will it be
 * unpleasant" but "what can stop this movement or hurt someone".
 *
 * Score is 0–100. GREEN under 25, AMBER 25–54, RED 55 and up.
 */
export function assessRisk(
  route: Route,
  input: TripInput,
  weather: WeatherReport,
  traffic: TrafficReport,
  restrictions: RestrictionReport,
  hos: HosPlan,
): RiskAssessment {
  const factors: RiskFactor[] = [];

  // --- Weather -------------------------------------------------------------
  const severePoints = weather.points.filter((p) => p.severity === 'severe');
  const advisoryPoints = weather.points.filter((p) => p.severity === 'advisory');

  if (severePoints.length > 0) {
    factors.push({
      label: 'Severe weather on route',
      detail: `${severePoints.length} segment${severePoints.length > 1 ? 's' : ''} with severe conditions — ${severePoints
        .map((p) => `${p.state} at mile ${p.atMile} (${p.summary})`)
        .join('; ')}.`,
      weight: Math.min(35, 18 + severePoints.length * 6),
      severity: 'high',
    });
  } else if (advisoryPoints.length > 0) {
    factors.push({
      label: 'Weather advisories on route',
      detail: `${advisoryPoints.length} segment${advisoryPoints.length > 1 ? 's' : ''} with winter precipitation or high wind.`,
      weight: Math.min(20, 8 + advisoryPoints.length * 4),
      severity: 'medium',
    });
  }

  const blowoverRisk = weather.points.filter((p) => p.gustMph >= 45);
  if (blowoverRisk.length > 0) {
    const empty = input.grossWeightLbs < 45000;
    factors.push({
      label: 'High-profile blowover risk',
      detail: `Gusts to ${Math.max(...blowoverRisk.map((p) => p.gustMph))} mph in ${[
        ...new Set(blowoverRisk.map((p) => p.state)),
      ].join(', ')}. ${
        empty
          ? 'Trailer is light — this is the condition that flips trucks. Consider holding.'
          : 'Loaded weight helps, but stay off the passes in the worst of it.'
      }`,
      weight: empty ? 25 : 12,
      severity: empty ? 'high' : 'medium',
    });
  }

  // --- Traffic -------------------------------------------------------------
  const closures = traffic.incidents.filter((i) => i.kind === 'closure');
  if (closures.length > 0) {
    factors.push({
      label: 'Road closure on route',
      detail: closures.map((c) => `${c.route} in ${c.state}: ${c.description}`).join(' '),
      weight: 20,
      severity: 'high',
    });
  }
  if (traffic.totalDelayMinutes >= 60) {
    factors.push({
      label: 'Significant traffic delay',
      detail: `About ${Math.round(traffic.totalDelayMinutes)} minutes of projected delay across ${traffic.incidents.length} incidents.`,
      weight: Math.min(12, traffic.totalDelayMinutes / 12),
      severity: traffic.totalDelayMinutes >= 120 ? 'high' : 'medium',
    });
  }

  // --- Restrictions --------------------------------------------------------
  const blocking = restrictions.restrictions.filter((r) => r.blocking);
  if (blocking.length > 0) {
    factors.push({
      label: 'Blocking restriction',
      detail: blocking.map((b) => b.title).join('; ') + '. Resolve before dispatch.',
      weight: 25,
      severity: 'high',
    });
  }

  const chainStates = restrictions.restrictions.filter((r) => r.kind === 'chain-law');
  if (chainStates.length > 0) {
    factors.push({
      label: 'Chain law season',
      detail: `Chains required or possible in ${[...new Set(chainStates.map((c) => c.state))].join(', ')}.`,
      weight: 8,
      severity: 'medium',
    });
  }

  // --- Hours of service ----------------------------------------------------
  if (input.deliverBy && !hos.legalOnTime) {
    factors.push({
      label: 'Cannot deliver legally on time',
      detail: `Projected arrival is ${Math.abs(hos.slackHours).toFixed(1)} hours past the appointment. Renegotiate the appointment or refuse the load — do not plan to run illegal.`,
      weight: 30,
      severity: 'high',
    });
  } else if (input.deliverBy && hos.slackHours < 3) {
    factors.push({
      label: 'Thin schedule margin',
      detail: `Only ${hos.slackHours.toFixed(1)} hours of slack against the appointment. One closure or a slow dock puts this load late.`,
      weight: 12,
      severity: 'medium',
    });
  }

  if (hos.cycleWarnings.length > 0) {
    factors.push({
      label: 'Hours-of-service pressure',
      detail: hos.cycleWarnings.join(' '),
      weight: 10,
      severity: 'medium',
    });
  }

  // --- Load characteristics ------------------------------------------------
  if (input.hazmat) {
    factors.push({
      label: 'Placarded hazmat load',
      detail:
        'Route restrictions, tunnel bans and inspection exposure all increase. Shipping papers must be within reach and placards correct before you roll.',
      weight: 10,
      severity: 'medium',
    });
  }
  if (input.oversize) {
    factors.push({
      label: 'Oversize movement',
      detail: 'Permit windows, curfews and escort coordination gate this load. Night and weekend movement is usually prohibited.',
      weight: 12,
      severity: 'medium',
    });
  }

  const rawScore = factors.reduce((s, f) => s + f.weight, 0);
  const score = Math.min(100, Math.round(rawScore));
  const level: RiskAssessment['level'] = score >= 55 ? 'RED' : score >= 25 ? 'AMBER' : 'GREEN';

  const bottomLine =
    level === 'RED'
      ? 'RED — Do not dispatch as planned. Resolve the blocking items above, reschedule, or refuse the load.'
      : level === 'AMBER'
        ? 'AMBER — Runnable with mitigation. Brief the driver on the items above, build in extra time, and set a check-in point.'
        : 'GREEN — No significant obstacles identified. Run the normal pre-trip and standard checks.';

  return { score, level, factors, bottomLine };
}
