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

/**
 * Live EIA diesel prices.
 *
 * EIA's API v2 is free and only needs a registration key:
 *
 *   GET https://api.eia.gov/v2/petroleum/pri/gnd/data/
 *     ?api_key={key}
 *     &frequency=weekly
 *     &data[0]=value
 *     &facets[product][]=EPD2D            (No 2 diesel, retail on-highway)
 *     &sort[0][column]=period&sort[0][direction]=desc
 *     &length=50
 *
 * Series IDs map one-to-one onto PaddRegion: EMD_EPD2D_PTE_NUS_DPG is the
 * national average, R10 New England, R1Y Central Atlantic, R1Z Lower Atlantic,
 * R20 Midwest, R30 Gulf Coast, R40 Rocky Mountain, R50 West Coast and
 * SCA California. Drop the returned values into REGIONAL_DIESEL and the rest of
 * this file works unchanged.
 *
 * For per-station pricing rather than regional averages, a commercial feed
 * (TruckerPath, Fuelbook, or a fuel-card network) is required.
 */
export class EiaFuel implements FuelProvider {
  readonly name = 'EIA weekly retail diesel';
  readonly live = true;

  constructor(private readonly apiBase: string) {}

  async prices(_route: Route): Promise<FuelReport> {
    throw new Error(
      'EiaFuel is not wired yet. Add an EIA key to the server proxy and implement the fetch.',
    );
  }
}
