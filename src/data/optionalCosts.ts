import { haversineMiles } from './geo';
import type {
  CostCategory,
  OptionalCostKey,
  OptionalCostSelection,
  TripInput,
} from '../types';

/**
 * Costs that depend on the load rather than the truck.
 *
 * The split that matters to a driver: diesel, tolls, tires and the truck
 * payment happen whether you want them to or not. A pilot car, a lumper, a
 * washout or a set of chains happen because *this particular load* needs them.
 * The first group is calculated for you. This group is a checklist you answer.
 *
 * `suggest` decides which ones get pre-flagged as likely — an oversize load
 * surfaces escort and permits, a reefer surfaces the washout. Suggested is not
 * the same as selected: nothing is charged until the driver taps it on. That
 * way the brief never quietly bills for something that did not happen, and the
 * driver never has to hunt for something that did.
 */

export type OptionalCostMode = 'flat' | 'per-mile' | 'per-night' | 'per-state';

export type OptionalCostDef = {
  key: OptionalCostKey;
  /** Full name, used in the brief. */
  label: string;
  /** Two or three words, used on the tap target. */
  short: string;
  hint: string;
  mode: OptionalCostMode;
  defaultAmount: number;
  category: CostCategory;
  outOfPocket: boolean;
  reimbursable: boolean;
  suggest: (t: TripInput) => boolean;
};

/** Straight-line distance, good enough to guess whether this is a long run. */
const roughMiles = (t: TripInput) => haversineMiles(t.origin, t.destination) * 1.18;

const isWinter = (t: TripInput) => {
  const m = new Date(t.departAt).getMonth() + 1;
  return m >= 11 || m <= 3;
};

export const OPTIONAL_COSTS: OptionalCostDef[] = [
  {
    key: 'lumper',
    label: 'Lumper fee',
    short: 'Lumper',
    hint: 'Paid at the receiver. You front the cash and get it back weeks later — get the receipt.',
    mode: 'flat',
    defaultAmount: 250,
    category: 'trip',
    outOfPocket: true,
    reimbursable: true,
    suggest: (t) => t.equipment === 'reefer' || t.equipment === 'dry-van',
  },
  {
    key: 'escort',
    label: 'Pilot / escort car',
    short: 'Pilot car',
    hint: 'Charged per mile. Most oversize permits require one, some require two.',
    mode: 'per-mile',
    defaultAmount: 2.25,
    category: 'trip',
    outOfPocket: true,
    reimbursable: true,
    suggest: (t) => t.oversize,
  },
  {
    key: 'oversize-permits',
    label: 'Oversize / overweight permits',
    short: 'Permits',
    hint: 'Per state crossed. Skip it if you already run annual permits.',
    mode: 'per-state',
    defaultAmount: 35,
    category: 'compliance',
    outOfPocket: true,
    reimbursable: true,
    suggest: (t) => t.oversize || t.grossWeightLbs > 80000,
  },
  {
    key: 'hazmat-compliance',
    label: 'Hazmat compliance',
    short: 'Hazmat',
    hint: 'Placards, shipping papers, segregation check, share of your annual registration.',
    mode: 'flat',
    defaultAmount: 50,
    category: 'compliance',
    outOfPocket: true,
    reimbursable: false,
    suggest: (t) => t.hazmat !== null,
  },
  {
    key: 'washout',
    label: 'Trailer washout',
    short: 'Washout',
    hint: 'Required between food-grade loads. Keep the ticket.',
    mode: 'flat',
    defaultAmount: 75,
    category: 'trip',
    outOfPocket: true,
    reimbursable: true,
    suggest: (t) => t.equipment === 'reefer' || t.equipment === 'tanker',
  },
  {
    key: 'chains',
    label: 'Chains',
    short: 'Chains',
    hint: 'Buying or replacing chains, plus the time to hang them.',
    mode: 'flat',
    defaultAmount: 45,
    category: 'compliance',
    outOfPocket: true,
    reimbursable: false,
    suggest: isWinter,
  },
  {
    key: 'securement',
    label: 'Load securement',
    short: 'Straps / tarps',
    hint: 'Straps, chains, corner protectors, load locks — the gear you lose or replace.',
    mode: 'flat',
    defaultAmount: 60,
    category: 'trip',
    outOfPocket: true,
    reimbursable: false,
    suggest: (t) => t.equipment === 'flatbed',
  },
  {
    key: 'reserved-parking',
    label: 'Reserved parking',
    short: 'Paid parking',
    hint: 'Per night. Free lots fill by 1600 in most markets — this is the price of not hunting.',
    mode: 'per-night',
    defaultAmount: 20,
    category: 'trip',
    outOfPocket: true,
    reimbursable: false,
    suggest: (t) => roughMiles(t) > 600,
  },
  {
    key: 'motel',
    label: 'Motel',
    short: 'Motel',
    hint: 'Per night, if you are not sleeping in the truck.',
    mode: 'per-night',
    defaultAmount: 120,
    category: 'driver',
    outOfPocket: true,
    reimbursable: false,
    suggest: () => false,
  },
  {
    key: 'extra-weigh',
    label: 'Extra scale weigh',
    short: 'Extra weigh',
    hint: 'A second CAT scale ticket after sliding the tandems.',
    mode: 'flat',
    defaultAmount: 16,
    category: 'trip',
    outOfPocket: true,
    reimbursable: false,
    suggest: (t) => t.grossWeightLbs > 76000 || t.hazmat !== null,
  },
];

export const optionalCostByKey = (key: OptionalCostKey): OptionalCostDef | undefined =>
  OPTIONAL_COSTS.find((o) => o.key === key);

/** Every optional cost starts off, at its typical amount. */
export function defaultOptionalCosts(): OptionalCostSelection[] {
  return OPTIONAL_COSTS.map((o) => ({ key: o.key, enabled: false, amount: o.defaultAmount }));
}

/** Convenience for tests and scripts: start from the defaults and turn some on. */
export function withOptional(
  enabled: Partial<Record<OptionalCostKey, number | true>>,
): OptionalCostSelection[] {
  return defaultOptionalCosts().map((sel) => {
    const override = enabled[sel.key];
    if (override === undefined) return sel;
    return {
      ...sel,
      enabled: true,
      amount: typeof override === 'number' ? override : sel.amount,
    };
  });
}

/** Human-readable unit, shown next to the amount field. */
export const modeSuffix = (mode: OptionalCostMode): string =>
  mode === 'per-mile' ? '$/mi'
  : mode === 'per-night' ? '$/night'
  : mode === 'per-state' ? '$/state'
  : '$';

/**
 * Resolves a selection into an actual dollar amount for this trip.
 * `nights` and `states` come from the finished route and HOS plan.
 */
export function resolveOptionalAmount(
  def: OptionalCostDef,
  amount: number,
  ctx: { totalMiles: number; nights: number; states: number },
): { total: number; basis: string } {
  switch (def.mode) {
    case 'per-mile':
      return {
        total: amount * ctx.totalMiles,
        basis: `${Math.round(ctx.totalMiles).toLocaleString()} mi × $${amount.toFixed(2)}/mi`,
      };
    case 'per-night':
      return {
        total: amount * ctx.nights,
        basis: `${ctx.nights} night${ctx.nights === 1 ? '' : 's'} × $${amount.toFixed(2)}`,
      };
    case 'per-state':
      return {
        total: amount * ctx.states,
        basis: `${ctx.states} state${ctx.states === 1 ? '' : 's'} × $${amount.toFixed(2)}`,
      };
    default:
      return { total: amount, basis: 'Flat amount you entered' };
  }
}
