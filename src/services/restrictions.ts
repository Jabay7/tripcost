import { TRIP_COSTS } from '../data/defaults';
import { STATES, isChainLawSeason } from '../data/states';
import type { Restriction, RestrictionReport, Route, StateCode, TripInput } from '../types';

export interface RestrictionProvider {
  readonly name: string;
  readonly live: boolean;
  check(route: Route, input: TripInput, departAt: Date): Promise<RestrictionReport>;
}

/** Tunnels and crossings that prohibit or restrict placarded hazmat loads. */
const HAZMAT_TUNNELS: Partial<Record<StateCode, { title: string; detail: string }[]>> = {
  MD: [{
    title: 'Baltimore harbor tunnels closed to hazmat',
    detail: 'I-95 Fort McHenry and I-895 Harbor Tunnel prohibit placarded loads. Route I-695 west around the city.',
  }],
  NY: [{
    title: 'NYC tunnels and most bridges closed to hazmat',
    detail: 'Lincoln, Holland, Queens-Midtown and Brooklyn-Battery prohibit placarded loads. Use the George Washington Bridge upper level or route north.',
  }],
  NJ: [{
    title: 'Hudson River crossings restricted',
    detail: 'Placarded loads barred from Hudson tunnels. Plan the GWB or I-287 well in advance.',
  }],
  VA: [{
    title: 'Hampton Roads tunnels closed to hazmat',
    detail: 'HRBT and Monitor-Merrimac prohibit placarded loads. Use the James River Bridge or I-295.',
  }],
  MA: [{
    title: 'Boston tunnels closed to hazmat',
    detail: 'Ted Williams and Sumner tunnels prohibit placarded loads. Use I-93 surface or I-495.',
  }],
  PA: [{
    title: 'Pittsburgh tunnels restricted',
    detail: 'Squirrel Hill and Fort Pitt tunnels restrict placarded loads. Verify class before committing.',
  }],
  CO: [{
    title: 'Eisenhower Tunnel closed to hazmat',
    detail: 'I-70 Eisenhower/Johnson tunnels prohibit hazmat. Mandatory detour over Loveland Pass US-6 — 11,990 ft, steep, no shoulder, closes in storms.',
  }],
};

export class MockRestrictions implements RestrictionProvider {
  readonly name = 'State restriction reference (offline)';
  readonly live = false;

  async check(route: Route, input: TripInput, departAt: Date): Promise<RestrictionReport> {
    const restrictions: Restriction[] = [];

    for (const state of route.states) {
      const info = STATES[state];

      if (input.hazmat) {
        for (const t of HAZMAT_TUNNELS[state] ?? []) {
          restrictions.push({
            kind: 'tunnel',
            state,
            title: t.title,
            detail: t.detail,
            costUsd: 0,
            blocking: true,
          });
        }
      }

      if (isChainLawSeason(state, departAt)) {
        restrictions.push({
          kind: 'chain-law',
          state,
          title: `${info.name} chain law season active`,
          detail:
            'Carry chains for the drive axles. Enforcement is on grades and passes; fines run into the hundreds and you can be held until you comply.',
          costUsd: TRIP_COSTS.chainUpAllowance,
          blocking: false,
        });
      }

      if (input.oversize) {
        restrictions.push({
          kind: 'oversize-permit',
          state,
          title: `${info.name} oversize/overweight permit`,
          detail:
            'Permit must be issued before entering the state. Most states restrict oversize movement at night, on weekends and on holidays.',
          costUsd: TRIP_COSTS.oversizePermitPerState,
          blocking: false,
        });
      }

      if (input.grossWeightLbs > 80000 && !input.oversize) {
        restrictions.push({
          kind: 'weight-limit',
          state,
          title: `Gross weight exceeds 80,000 lb federal limit in ${info.name}`,
          detail:
            'An overweight permit is required. Running without one risks a fine and being shut down at the scale until the load is redistributed or transferred.',
          costUsd: TRIP_COSTS.oversizePermitPerState,
          blocking: true,
        });
      }

      if (state === 'CA') {
        restrictions.push({
          kind: 'idle-restriction',
          state,
          title: 'California idle limit and CARB compliance',
          detail:
            'Five-minute idle limit statewide; the engine and trailer must be CARB-compliant. Non-compliant equipment is subject to citation and denial of entry.',
          costUsd: 0,
          blocking: false,
        });
      }

      if (state === 'NM' || state === 'OR' || state === 'NY' || state === 'KY') {
        restrictions.push({
          kind: 'port-of-entry',
          state,
          title: `${info.name} weight-distance tax`,
          detail:
            state === 'OR'
              ? 'Oregon charges a weight-mile tax instead of fuel tax. A permit and mileage report are required.'
              : 'A weight-distance or highway-use tax permit is required before entering.',
          costUsd: 0,
          blocking: false,
        });
      }

      for (const note of info.notes) {
        restrictions.push({
          kind: 'bridge-clearance',
          state,
          title: `${info.name} note`,
          detail: note,
          costUsd: 0,
          blocking: false,
        });
      }
    }

    return { restrictions, provider: this.name };
  }
}

/**
 * Live restriction data.
 *
 * There is no single national feed. A production build stitches together:
 *
 *  - FMCSA Hazardous Materials Route Registry for state-designated and
 *    prohibited hazmat routes (published as a downloadable dataset, not an API,
 *    so mirror it server-side and refresh quarterly).
 *  - A commercial truck-attribute map (HERE, TomTom or Trimble) for bridge
 *    clearances, weight limits and posted truck restrictions along the polyline.
 *    This is the only reliable source of low-clearance data.
 *  - State 511 feeds for live chain controls and seasonal frost laws.
 *  - State permitting portals for oversize/overweight fees, which vary by axle
 *    configuration and route, not just by state.
 */
export class LiveRestrictions implements RestrictionProvider {
  readonly name = 'FMCSA + commercial truck attributes';
  readonly live = true;

  constructor(private readonly apiBase: string) {}

  async check(): Promise<RestrictionReport> {
    throw new Error('LiveRestrictions is not wired yet. Implement the restriction lookups.');
  }
}
