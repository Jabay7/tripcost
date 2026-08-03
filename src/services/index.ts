import { computeCosts } from '../calc/costs';
import { planHos } from '../calc/hos';
import { assessRisk } from '../calc/risk';
import type { AddedCost, HosPlan, TripBrief, TripInput, TruckProfile } from '../types';
import { MockFuel, type FuelProvider } from './fuel';
import { MockRestrictions, type RestrictionProvider } from './restrictions';
import { MockRouting, OpenRouteService, type RoutingProvider } from './routing';
import { MockTraffic, type TrafficProvider } from './traffic';
import { MockWeather, NwsWeather, type WeatherProvider } from './weather';

export * from './fuel';
export * from './restrictions';
export * from './routing';
export * from './traffic';
export * from './weather';

export type ServiceBundle = {
  routing: RoutingProvider;
  fuel: FuelProvider;
  weather: WeatherProvider;
  traffic: TrafficProvider;
  restrictions: RestrictionProvider;
};

/**
 * Offline bundle. Every provider here is a drop-in replacement away from live.
 *
 * To go live, construct a bundle with the real providers instead:
 *
 *   const live: ServiceBundle = {
 *     routing: new HereRouting(API_BASE),
 *     fuel: new EiaFuel(API_BASE),
 *     weather: new NwsWeather('TripCost (you@example.com)'),
 *     traffic: new HereTraffic(API_BASE),
 *     restrictions: new LiveRestrictions(API_BASE),
 *   };
 *
 * Mix freely — NWS weather is free and needs no key, so it can go live long
 * before routing does.
 */
export const MOCK_SERVICES: ServiceBundle = {
  routing: new MockRouting(),
  fuel: new MockFuel(),
  weather: new MockWeather(),
  traffic: new MockTraffic(),
  restrictions: new MockRestrictions(),
};

/**
 * How the app identifies itself to the National Weather Service. NWS asks that
 * callers identify their application and a contact address so they can reach
 * you if a request pattern causes them trouble.
 */
const NWS_USER_AGENT =
  process.env.EXPO_PUBLIC_NWS_USER_AGENT ?? 'TripCost (support@example.com)';

/**
 * What the app actually runs with.
 *
 * NWS weather is free and needs no key, so it is live by default — one of the
 * five feeds is real out of the box. The rest stay modeled until keys exist,
 * and the brief labels each one honestly either way.
 *
 * Set EXPO_PUBLIC_NWS_USER_AGENT to your own contact address before shipping.
 */
export const DEFAULT_SERVICES: ServiceBundle = {
  ...MOCK_SERVICES,
  weather: new NwsWeather(NWS_USER_AGENT),
  // Truck routing switches on the moment a key exists. Free, no card:
  // openrouteservice.org/dev/#/signup → EXPO_PUBLIC_ORS_KEY.
  ...(process.env.EXPO_PUBLIC_ORS_KEY
    ? {
        routing: new OpenRouteService(
          'https://api.openrouteservice.org',
          process.env.EXPO_PUBLIC_ORS_KEY,
        ),
      }
    : {}),
};

/**
 * Projects when the truck reaches a given mile marker, accounting for every
 * break and reset scheduled before that point. Weather is only useful if it is
 * the forecast for when you are actually there.
 */
function etaResolver(hos: HosPlan, departAt: Date, speedMph: number) {
  return (mile: number): Date => {
    const driveHours = mile / Math.max(30, speedMph);
    const stoppedHours = hos.stops
      .filter((s) => s.atMile <= mile)
      .reduce((sum, s) => sum + s.durationHours, 0);
    return new Date(departAt.getTime() + (driveHours + stoppedHours) * 3_600_000);
  };
}

export async function buildTripBrief(
  input: TripInput,
  profile: TruckProfile,
  addedCosts: AddedCost[] = [],
  services: ServiceBundle = MOCK_SERVICES,
): Promise<TripBrief> {
  const depart = new Date(input.departAt);

  const route = await services.routing.route(input);

  // Traffic first — its delay feeds the hours-of-service plan, which in turn
  // determines when the truck is standing in each weather system.
  const traffic = await services.traffic.incidents(route);
  const hos = planHos(route, input, profile, traffic.totalDelayMinutes);
  route.driveHours = hos.drivingHours;

  const [fuel, weather, restrictions] = await Promise.all([
    services.fuel.prices(route),
    services.weather.forecast(route, etaResolver(hos, depart, profile.avgSpeedMph)),
    services.restrictions.check(route, input, depart),
  ]);

  const risk = assessRisk(route, input, weather, traffic, restrictions, hos);
  const cost = computeCosts(route, input, profile, fuel, hos, risk.level, addedCosts);

  const sources = [
    { service: 'Routing', provider: services.routing.name, live: services.routing.live },
    { service: 'Fuel', provider: services.fuel.name, live: services.fuel.live },
    { service: 'Weather', provider: services.weather.name, live: services.weather.live },
    { service: 'Traffic', provider: services.traffic.name, live: services.traffic.live },
    { service: 'Restrictions', provider: services.restrictions.name, live: services.restrictions.live },
  ];

  return {
    input,
    addedCosts,
    profile,
    route,
    fuel,
    weather,
    traffic,
    restrictions,
    hos,
    cost,
    risk,
    generatedAt: new Date().toISOString(),
    containsMockData: sources.some((s) => !s.live),
    sources,
  };
}
