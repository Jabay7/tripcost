import { MEDIAN_DIESEL_TAX_CPG, STATES } from '../data/states';
import type { FuelQuote, FuelReport, PaddRegion, Route, StateCode } from '../types';

export interface FuelProvider {
  readonly name: string;
  readonly live: boolean;
  prices(route: Route): Promise<FuelReport>;
}

/**
 * Regional retail on-highway diesel, the same cut EIA publishes every Monday.
 * Values are representative, not live — `EiaFuel` replaces them with the real
 * series once a key is present.
 */
const REGIONAL_DIESEL: Record<PaddRegion, number> = {
  NEW_ENGLAND: 4.05,
  CENTRAL_ATLANTIC: 3.95,
  LOWER_ATLANTIC: 3.62,
  MIDWEST: 3.71,
  GULF_COAST: 3.45,
  ROCKY_MOUNTAIN: 3.88,
  WEST_COAST: 4.42,
  CALIFORNIA: 5.15,
};

const NATIONAL_AVG = 3.78;

/**
 * Spreads a regional price down to a state using the state's diesel tax burden.
 * California is already its own EIA region, so it takes no further adjustment.
 */
export function statePrice(state: StateCode): number {
  const info = STATES[state];
  const base = REGIONAL_DIESEL[info.padd];
  if (info.padd === 'CALIFORNIA') return base;
  const taxDelta = (info.dieselTaxCpg - MEDIAN_DIESEL_TAX_CPG) / 100;
  return Math.max(2.5, base + taxDelta);
}

export class MockFuel implements FuelProvider {
  readonly name = 'EIA regional averages (offline snapshot)';
  readonly live = false;

  async prices(route: Route): Promise<FuelReport> {
    const byState: FuelQuote[] = route.segments.map((seg) => ({
      region: STATES[seg.state].padd,
      state: seg.state,
      pricePerGal: statePrice(seg.state),
      miles: seg.miles,
    }));

    // Collapse repeated states so the brief lists each one once.
    const merged = new Map<StateCode, FuelQuote>();
    for (const q of byState) {
      const existing = merged.get(q.state);
      if (existing) existing.miles += q.miles;
      else merged.set(q.state, { ...q });
    }
    const quotes = [...merged.values()];

    const totalMiles = quotes.reduce((s, q) => s + q.miles, 0) || 1;
    const blended =
      quotes.reduce((s, q) => s + q.pricePerGal * q.miles, 0) / totalMiles;

    const cheapest = quotes.reduce((a, b) => (b.pricePerGal < a.pricePerGal ? b : a), quotes[0]);

    return {
      blendedPricePerGal: blended,
      byState: quotes,
      nationalAvg: NATIONAL_AVG,
      cheapestState: cheapest?.state ?? 'TX',
      cheapestPrice: cheapest?.pricePerGal ?? NATIONAL_AVG,
      asOf: 'offline snapshot',
      provider: this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Live: EIA weekly retail diesel
// ---------------------------------------------------------------------------

/**
 * EIA's area codes, mapped onto the app's regions.
 *
 * Two of these are easy to get wrong and neither fails loudly:
 *
 *  - R10 is the whole of PADD 1 (the entire East Coast), *not* New England.
 *    New England is R1X. Using R10 silently prices Maine off a Florida-to-Maine
 *    average.
 *  - R50 is all of PADD 5 including California. Since California is tracked
 *    separately here, R5XCA (PADD 5 except California) is the correct source
 *    for the rest of the West Coast — otherwise California's much higher price
 *    is counted twice and drags Oregon and Washington up with it.
 */
const DUOAREA_TO_PADD: Record<string, PaddRegion> = {
  R1X: 'NEW_ENGLAND',
  R1Y: 'CENTRAL_ATLANTIC',
  R1Z: 'LOWER_ATLANTIC',
  R20: 'MIDWEST',
  R30: 'GULF_COAST',
  R40: 'ROCKY_MOUNTAIN',
  R5XCA: 'WEST_COAST',
  SCA: 'CALIFORNIA',
};

type EiaRow = { period?: string; duoarea?: string; value?: number | string };

/**
 * Live diesel prices from the US Energy Information Administration.
 *
 * Free, needs only a registration key, and publishes every Monday. This is the
 * same series the offline snapshot was copied from — the difference is that
 * these numbers are current rather than however old the snapshot happens to be.
 *
 * Prices are still *regional*, not per-station. That is a real limit and the
 * driver brief says so: it answers "fill in Texas, not Illinois", not "the pump
 * price at the Love's on exit 312". Per-station data only exists behind
 * commercial feeds.
 *
 * Fetched once per instance and cached — the data only changes weekly, so
 * re-requesting it per trip would burn quota for nothing. A failure falls back
 * to the offline snapshot rather than breaking the brief, and says so in the
 * provider name so it shows up in the brief's data-sources list.
 */
export class EiaFuel implements FuelProvider {
  readonly name = 'EIA weekly retail diesel';
  readonly live = true;

  private cache: { regional: Record<PaddRegion, number>; national: number; asOf: string } | null =
    null;
  private readonly fallback = new MockFuel();

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 10_000,
  ) {}

  private async load() {
    if (this.cache) return this.cache;

    const params = new URLSearchParams({
      api_key: this.apiKey,
      frequency: 'weekly',
      'data[0]': 'value',
      // EPD2D = No 2 diesel; PTE = retail sales by all sellers.
      'facets[product][]': 'EPD2D',
      'facets[process][]': 'PTE',
      'sort[0][column]': 'period',
      'sort[0][direction]': 'desc',
      // One week covers every region; a little headroom for staggered updates.
      length: '60',
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`https://api.eia.gov/v2/petroleum/pri/gnd/data/?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`EIA returned ${res.status}`);

      const json = (await res.json()) as { response?: { data?: EiaRow[] } };
      const rows = json.response?.data ?? [];
      if (rows.length === 0) throw new Error('EIA returned no rows');

      // Rows are newest-first, so the first sighting of a region is its most
      // recent price.
      const regional = { ...REGIONAL_DIESEL };
      const seen = new Set<string>();
      let national = NATIONAL_AVG;
      let asOf = '';

      for (const row of rows) {
        const value = typeof row.value === 'string' ? parseFloat(row.value) : row.value;
        if (!Number.isFinite(value) || !row.duoarea || seen.has(row.duoarea)) continue;
        seen.add(row.duoarea);
        if (!asOf && row.period) asOf = row.period;

        if (row.duoarea === 'NUS') national = value as number;
        const padd = DUOAREA_TO_PADD[row.duoarea];
        if (padd) regional[padd] = value as number;
      }

      this.cache = { regional, national, asOf: asOf || 'latest' };
      return this.cache;
    } finally {
      clearTimeout(timer);
    }
  }

  async prices(route: Route): Promise<FuelReport> {
    let live: Awaited<ReturnType<EiaFuel['load']>>;
    try {
      live = await this.load();
    } catch {
      // Stale-but-plausible beats no brief. Say which it was.
      const snapshot = await this.fallback.prices(route);
      return { ...snapshot, provider: `${this.name} unreachable — using offline snapshot` };
    }

    const byState = new Map<StateCode, FuelQuote>();
    for (const seg of route.segments) {
      const info = STATES[seg.state];
      const base = live.regional[info.padd];
      const price =
        info.padd === 'CALIFORNIA'
          ? base
          : Math.max(2.5, base + (info.dieselTaxCpg - MEDIAN_DIESEL_TAX_CPG) / 100);

      const existing = byState.get(seg.state);
      if (existing) existing.miles += seg.miles;
      else
        byState.set(seg.state, {
          region: info.padd,
          state: seg.state,
          pricePerGal: price,
          miles: seg.miles,
        });
    }

    const quotes = [...byState.values()];
    const totalMiles = quotes.reduce((s, q) => s + q.miles, 0) || 1;
    const blended = quotes.reduce((s, q) => s + q.pricePerGal * q.miles, 0) / totalMiles;
    const cheapest = quotes.reduce((a, b) => (b.pricePerGal < a.pricePerGal ? b : a), quotes[0]);

    return {
      blendedPricePerGal: blended,
      byState: quotes,
      nationalAvg: live.national,
      cheapestState: cheapest?.state ?? 'TX',
      cheapestPrice: cheapest?.pricePerGal ?? live.national,
      asOf: `week of ${live.asOf}`,
      provider: this.name,
    };
  }
}
