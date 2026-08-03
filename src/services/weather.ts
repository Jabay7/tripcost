import { STATES, isChainLawSeason } from '../data/states';
import type {
  Route,
  StateCode,
  WeatherPoint,
  WeatherReport,
  WeatherSeverity,
} from '../types';

export interface WeatherProvider {
  readonly name: string;
  readonly live: boolean;
  /** `etaAtMile` converts a route mile marker into the time the truck is there. */
  forecast(route: Route, etaAtMile: (mile: number) => Date): Promise<WeatherReport>;
}

/** Stable pseudo-random in [0,1) so a given route/day always briefs the same. */
function hash01(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** States where sustained crosswinds regularly flip empty and light trailers. */
const HIGH_WIND_STATES: StateCode[] = ['WY', 'NE', 'KS', 'OK', 'TX', 'NM', 'CO', 'SD', 'ND', 'MT', 'IA', 'MN'];

/**
 * Rough climatological temperature for a latitude and month.
 *
 * `seasonal` runs +1 in July and −1 in January, so it is ADDED: January must
 * come out below the annual mean, not above it.
 *
 * Annual mean falls about 1.5°F per degree of latitude across the lower 48
 * (roughly 76°F on the Gulf coast down to 42°F on the northern border), and the
 * seasonal swing widens as you go north — the Rio Grande barely moves through
 * the year, the northern plains swing about 25°F either side of the mean.
 */
function seasonalTempF(lat: number, month: number, jitter: number): number {
  const seasonal = Math.cos(((month - 7) / 12) * 2 * Math.PI);
  const annualMean = 76 - (lat - 25) * 1.48;
  const swing = 8 + Math.max(0, lat - 25) * 0.75;
  return Math.round(annualMean + seasonal * swing + (jitter - 0.5) * 12);
}

function classify(
  tempF: number,
  gustMph: number,
  precip: WeatherPoint['precip'],
  visibilityMi: number,
): WeatherSeverity {
  if (precip === 'ice' || visibilityMi < 0.5 || gustMph >= 55) return 'severe';
  if (precip === 'snow' && visibilityMi < 2) return 'severe';
  if (precip === 'snow' || precip === 'mixed' || gustMph >= 45 || visibilityMi < 2) return 'advisory';
  if (tempF <= 32 || gustMph >= 35 || precip === 'rain') return 'caution';
  return 'clear';
}

const SEVERITY_RANK: Record<WeatherSeverity, number> = {
  clear: 0,
  caution: 1,
  advisory: 2,
  severe: 3,
};

export class MockWeather implements WeatherProvider {
  readonly name = 'Climatological model (offline)';
  readonly live = false;

  async forecast(route: Route, etaAtMile: (mile: number) => Date): Promise<WeatherReport> {
    const points: WeatherPoint[] = route.segments.map((seg) => {
      const eta = etaAtMile(seg.cumulativeMiles - seg.miles / 2);
      const month = eta.getMonth() + 1;
      const day = eta.getDate();
      const seed = hash01(seg.state, month, day, Math.round(seg.midpoint.lat));

      const tempF = seasonalTempF(seg.midpoint.lat, month, seed);

      const windy = HIGH_WIND_STATES.includes(seg.state);
      const windMph = Math.round((windy ? 14 : 6) + seed * (windy ? 26 : 14));
      // Gust factor over sustained wind is typically 1.3–1.6 and rarely more
      // than 25 mph above it. Compounding the seed into both terms without a
      // cap produced hurricane-force gusts on ordinary days.
      const gustMph = Math.min(
        windMph + 25,
        Math.round(windMph * (1.25 + seed * 0.3)),
      );

      const wet = hash01(seg.state, day, 'precip') > 0.62;
      let precip: WeatherPoint['precip'] = 'none';
      if (wet) {
        if (tempF <= 28) precip = 'snow';
        else if (tempF <= 34) precip = 'ice';
        else if (tempF <= 38) precip = 'mixed';
        else precip = 'rain';
      }

      let visibilityMi = 10;
      if (precip === 'snow') visibilityMi = 0.5 + seed * 2.5;
      else if (precip === 'ice' || precip === 'mixed') visibilityMi = 1.5 + seed * 3;
      else if (precip === 'rain') visibilityMi = 3 + seed * 6;

      const severity = classify(tempF, gustMph, precip, visibilityMi);

      const alerts: string[] = [];
      if (gustMph >= 45) {
        alerts.push(
          `High Wind Warning — gusts to ${gustMph} mph. High-profile vehicles at risk of blowover.`,
        );
      }
      if (precip === 'ice') alerts.push('Winter Weather Advisory — freezing rain, bridges ice first.');
      if (precip === 'snow' && visibilityMi < 1.5) alerts.push('Blizzard conditions possible — near-zero visibility.');
      if (isChainLawSeason(seg.state, eta) && tempF <= 34 && precip !== 'none') {
        alerts.push(`${STATES[seg.state].name} chain law may be active on grades.`);
      }

      const parts = [`${tempF}°F`];
      if (precip !== 'none') parts.push(precip);
      parts.push(`wind ${windMph} G${gustMph}`);
      if (visibilityMi < 10) parts.push(`vis ${visibilityMi.toFixed(1)} mi`);

      return {
        state: seg.state,
        atMile: Math.round(seg.cumulativeMiles - seg.miles / 2),
        eta: eta.toISOString(),
        tempF,
        windMph,
        gustMph,
        precip,
        visibilityMi: Number(visibilityMi.toFixed(1)),
        severity,
        summary: parts.join(' · '),
        alerts,
      };
    });

    const worst = points.reduce<WeatherSeverity>(
      (acc, p) => (SEVERITY_RANK[p.severity] > SEVERITY_RANK[acc] ? p.severity : acc),
      'clear',
    );

    return { points, worst, provider: this.name };
  }
}

/**
 * Live weather from the National Weather Service.
 *
 * NWS is free, needs no key, and only asks for a descriptive User-Agent:
 *
 *   GET https://api.weather.gov/points/{lat},{lon}
 *      -> .properties.forecastHourly  and  .properties.forecastGridData
 *   GET {forecastHourly}
 *      -> periods[] with temperature, windSpeed, shortForecast, probabilityOfPrecipitation
 *   GET https://api.weather.gov/alerts/active?point={lat},{lon}
 *      -> features[].properties.headline / .event / .severity
 *
 * Pick the hourly period whose `startTime` brackets the truck's ETA at that
 * segment, then map `severity` from the alert `event` field. Coverage is US
 * only; for Canadian legs use Environment Canada or a commercial provider.
 */
export class NwsWeather implements WeatherProvider {
  readonly name = 'National Weather Service';
  readonly live = true;

  constructor(private readonly userAgent: string) {}

  async forecast(): Promise<WeatherReport> {
    throw new Error('NwsWeather is not wired yet. Implement the api.weather.gov fetch.');
  }
}
