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

// ---------------------------------------------------------------------------
// Live: National Weather Service
// ---------------------------------------------------------------------------

/** NWS grid cells are ~2.5 km. Rounding to 2 decimals (~1 km) is a safe key. */
const gridKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

type NwsPeriod = {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string | null;
  windGust: string | null;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
};

/**
 * Parses an NWS wind string. They come as "10 mph" or "10 to 15 mph" — take
 * the top of the range, which is the number that matters to a high-profile
 * vehicle.
 */
function parseWindMph(s: string | null | undefined): number {
  if (!s) return 0;
  const numbers = s.match(/\d+/g);
  if (!numbers) return 0;
  return Math.max(...numbers.map(Number));
}

/** Maps an NWS `shortForecast` phrase onto the app's precipitation types. */
function parsePrecip(shortForecast: string, tempF: number): WeatherPoint['precip'] {
  const f = shortForecast.toLowerCase();
  if (/freezing|ice|sleet/.test(f)) return 'ice';
  if (/wintry mix|rain and snow|snow and rain/.test(f)) return 'mixed';
  if (/snow|flurr|blizzard/.test(f)) return tempF > 34 ? 'mixed' : 'snow';
  if (/rain|shower|thunder|drizzle/.test(f)) return 'rain';
  return 'none';
}

/**
 * NWS hourly forecasts do not carry visibility, so it is inferred from the
 * conditions rather than invented. Fog and heavy frozen precipitation are what
 * actually shut a driver down.
 */
function inferVisibilityMi(shortForecast: string, precip: WeatherPoint['precip']): number {
  const f = shortForecast.toLowerCase();
  if (/dense fog/.test(f)) return 0.25;
  if (/fog|haze|smoke/.test(f)) return 1.5;
  if (/blizzard|heavy snow/.test(f)) return 0.5;
  if (precip === 'snow') return 2;
  if (precip === 'ice' || precip === 'mixed') return 3;
  if (/heavy rain|thunderstorm/.test(f)) return 3;
  if (precip === 'rain') return 6;
  return 10;
}

/**
 * Live weather from the National Weather Service.
 *
 * NWS is free, needs no key, and only asks for a descriptive User-Agent
 * identifying the application. Three calls per route segment:
 *
 *   GET /points/{lat},{lon}          -> the forecast office + grid URLs
 *   GET {properties.forecastHourly}  -> hourly periods
 *   GET /alerts/active?point={lat},{lon}
 *
 * Two things make this usable on a phone on a cell connection:
 *
 *  - Segments are fetched in parallel, and `/points` responses are cached in
 *    memory keyed by grid cell. A route that crosses the same state twice pays
 *    for one lookup, not two.
 *  - A segment that fails falls back to the offline model for that segment
 *    only. One flaky request must not cost the driver the whole brief, so the
 *    result degrades point by point rather than all at once.
 *
 * Coverage is the US and its territories. A Canadian leg needs Environment
 * Canada or a commercial provider.
 */
export class NwsWeather implements WeatherProvider {
  readonly name = 'National Weather Service';
  readonly live = true;

  private readonly pointCache = new Map<string, string | null>();
  private readonly fallback = new MockWeather();

  constructor(
    /** e.g. "TripCost (dispatch@yourcarrier.com)" — NWS asks you to identify. */
    private readonly userAgent: string,
    private readonly timeoutMs = 8000,
  ) {}

  private async getJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/geo+json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Resolves the hourly-forecast URL for a coordinate, caching by grid cell. */
  private async hourlyUrl(lat: number, lon: number): Promise<string | null> {
    const key = gridKey(lat, lon);
    const cached = this.pointCache.get(key);
    if (cached !== undefined) return cached;

    try {
      const data = await this.getJson<{ properties?: { forecastHourly?: string } }>(
        `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      );
      const url = data.properties?.forecastHourly ?? null;
      this.pointCache.set(key, url);
      return url;
    } catch {
      // Cache the miss too — a point outside NWS coverage will not start
      // working on a retry, and re-asking costs the driver time.
      this.pointCache.set(key, null);
      return null;
    }
  }

  private async alertsFor(lat: number, lon: number): Promise<string[]> {
    try {
      const data = await this.getJson<{
        features?: { properties?: { event?: string; headline?: string; severity?: string } }[];
      }>(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`);

      return (data.features ?? [])
        .map((f) => f.properties?.headline || f.properties?.event || '')
        .filter((s): s is string => s.length > 0)
        .slice(0, 4); // A brief the driver will actually read.
    } catch {
      return [];
    }
  }

  async forecast(route: Route, etaAtMile: (mile: number) => Date): Promise<WeatherReport> {
    // Fall back for any segment we cannot resolve, so a partial outage
    // degrades one point instead of the whole brief.
    const modelled = await this.fallback.forecast(route, etaAtMile);

    const points = await Promise.all(
      route.segments.map(async (seg, i): Promise<WeatherPoint> => {
        const { lat, lon } = seg.midpoint;
        const eta = etaAtMile(seg.cumulativeMiles - seg.miles / 2);

        try {
          const url = await this.hourlyUrl(lat, lon);
          if (!url) return modelled.points[i];

          const [forecast, alerts] = await Promise.all([
            this.getJson<{ properties?: { periods?: NwsPeriod[] } }>(url),
            this.alertsFor(lat, lon),
          ]);

          const periods = forecast.properties?.periods ?? [];
          if (periods.length === 0) return modelled.points[i];

          // The period the truck is actually standing in. NWS publishes about
          // 156 hours; a trip beyond that falls back to the last period rather
          // than pretending to know.
          const target = eta.getTime();
          const period =
            periods.find(
              (p) => new Date(p.startTime).getTime() <= target && target < new Date(p.endTime).getTime(),
            ) ??
            (target < new Date(periods[0].startTime).getTime()
              ? periods[0]
              : periods[periods.length - 1]);

          const tempF =
            period.temperatureUnit === 'C'
              ? Math.round((period.temperature * 9) / 5 + 32)
              : Math.round(period.temperature);

          const windMph = parseWindMph(period.windSpeed);
          const gustMph = Math.max(windMph, parseWindMph(period.windGust));
          const precip = parsePrecip(period.shortForecast, tempF);
          const visibilityMi = inferVisibilityMi(period.shortForecast, precip);
          const severity = classify(tempF, gustMph, precip, visibilityMi);

          const extra: string[] = [];
          if (gustMph >= 45) {
            extra.push(
              `Gusts to ${gustMph} mph. High-profile vehicles at risk of blowover.`,
            );
          }
          if (isChainLawSeason(seg.state, eta) && tempF <= 34 && precip !== 'none') {
            extra.push(`${STATES[seg.state].name} chain law may be active on grades.`);
          }

          const parts = [`${tempF}°F`, period.shortForecast];
          if (windMph > 0) parts.push(`wind ${windMph}${gustMph > windMph ? ` G${gustMph}` : ''}`);
          if (visibilityMi < 10) parts.push(`vis ~${visibilityMi} mi`);

          return {
            state: seg.state,
            atMile: Math.round(seg.cumulativeMiles - seg.miles / 2),
            eta: eta.toISOString(),
            tempF,
            windMph,
            gustMph,
            precip,
            visibilityMi,
            severity,
            summary: parts.join(' · '),
            alerts: [...alerts, ...extra],
          };
        } catch {
          return modelled.points[i];
        }
      }),
    );

    const worst = points.reduce<WeatherSeverity>(
      (acc, p) => (SEVERITY_RANK[p.severity] > SEVERITY_RANK[acc] ? p.severity : acc),
      'clear',
    );

    // Be honest about a full outage rather than silently serving the model.
    const anyLive = points.some((p, i) => p !== modelled.points[i]);
    return {
      points,
      worst,
      provider: anyLive ? this.name : `${this.name} unreachable — showing modeled weather`,
    };
  }
}
