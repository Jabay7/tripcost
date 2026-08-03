import { TRIP_COSTS, CONTINGENCY_BY_RISK } from '../data/defaults';
import type {
  AddedCost,
  CostLine,
  CostReport,
  FuelReport,
  HosPlan,
  RestrictionReport,
  RevenueLine,
  Route,
  TripInput,
  TruckProfile,
} from '../types';

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Builds the full cost and revenue picture for a trip.
 *
 * Three things this deliberately does differently from a napkin calculation:
 *
 *  1. Deadhead miles are counted as cost but never as revenue. This is the
 *     single most common way an owner-operator talks themselves into a bad
 *     load.
 *  2. Fixed costs are allocated by the days the trip actually consumes. The
 *     truck payment does not pause because the load only paid for 400 miles.
 *  3. Out-of-pocket spend is tracked separately from total cost, because
 *     lumpers and fuel come out of the driver's pocket weeks before the
 *     settlement arrives.
 */
export function computeCosts(
  route: Route,
  input: TripInput,
  profile: TruckProfile,
  fuel: FuelReport,
  hos: HosPlan,
  restrictions: RestrictionReport,
  riskLevel: 'GREEN' | 'AMBER' | 'RED',
  addedCosts: AddedCost[] = [],
): CostReport {
  const totalMiles = route.totalMiles;
  const loadedMiles = Math.max(1, totalMiles - input.deadheadMiles);
  const lines: CostLine[] = [];

  const add = (
    key: string,
    label: string,
    amount: number,
    basis: string,
    category: CostLine['category'],
    opts: { outOfPocket?: boolean; reimbursable?: boolean } = {},
  ) => {
    if (amount <= 0.005) return;
    lines.push({
      key,
      label,
      amount: money(amount),
      basis,
      category,
      outOfPocket: opts.outOfPocket ?? false,
      reimbursable: opts.reimbursable ?? false,
    });
  };

  // --- Fuel ----------------------------------------------------------------
  const tractorGallons = totalMiles / Math.max(1, profile.mpg);
  add(
    'fuel',
    'Diesel (tractor)',
    tractorGallons * fuel.blendedPricePerGal,
    `${Math.round(totalMiles)} mi ÷ ${profile.mpg} mpg = ${tractorGallons.toFixed(0)} gal @ $${fuel.blendedPricePerGal.toFixed(3)}/gal blended`,
    'fuel',
    { outOfPocket: true },
  );

  add(
    'def',
    'DEF',
    tractorGallons * profile.defFraction * profile.defPricePerGal,
    `${(tractorGallons * profile.defFraction).toFixed(1)} gal @ $${profile.defPricePerGal.toFixed(2)} (${(profile.defFraction * 100).toFixed(1)}% of diesel)`,
    'fuel',
    { outOfPocket: true },
  );

  if (input.equipment === 'reefer' && input.reeferSetPointF !== null) {
    const reeferHours = hos.totalElapsedHours;
    add(
      'reefer-fuel',
      'Reefer unit fuel',
      reeferHours * profile.reeferGalPerHour * fuel.blendedPricePerGal,
      `${reeferHours.toFixed(1)} hr @ ${profile.reeferGalPerHour} gal/hr holding ${input.reeferSetPointF}°F`,
      'fuel',
      { outOfPocket: true },
    );
  }

  if (hos.nightsOut > 0) {
    const idleHours = hos.nightsOut * 8;
    add(
      'idle-fuel',
      'Overnight idle / APU',
      idleHours * profile.idleGalPerHour * fuel.blendedPricePerGal,
      `${hos.nightsOut} night${hos.nightsOut > 1 ? 's' : ''} × 8 hr @ ${profile.idleGalPerHour} gal/hr`,
      'fuel',
      { outOfPocket: true },
    );
  }

  // --- Variable per-mile ---------------------------------------------------
  add(
    'tires',
    'Tires',
    totalMiles * profile.tiresCpm,
    `${Math.round(totalMiles)} mi × $${profile.tiresCpm.toFixed(3)}/mi`,
    'variable',
  );
  add(
    'maintenance',
    'Maintenance & repair',
    totalMiles * profile.maintenanceCpm,
    `${Math.round(totalMiles)} mi × $${profile.maintenanceCpm.toFixed(3)}/mi`,
    'variable',
  );

  // --- Fixed overhead, allocated by days consumed --------------------------
  const monthlyFixed =
    profile.truckPaymentMo +
    profile.trailerPaymentMo +
    profile.insuranceMo +
    profile.permitsLicensingMo +
    profile.eldTelematicsMo +
    profile.accountingLegalMo +
    profile.overheadMo;
  const dailyFixed = monthlyFixed / Math.max(1, profile.workingDaysPerMonth);
  const fixedDays = Math.max(0.5, hos.totalElapsedHours / 24);
  add(
    'fixed',
    'Fixed overhead',
    dailyFixed * fixedDays,
    `$${money(dailyFixed).toLocaleString()}/day × ${fixedDays.toFixed(2)} days — truck, trailer, insurance, permits, ELD, accounting`,
    'fixed',
  );

  // --- Driver --------------------------------------------------------------
  const linehaul = input.rateMode === 'flat' ? input.rate : input.rate * loadedMiles;

  if (profile.driverPayMode === 'per-mile') {
    add(
      'driver-pay',
      'Driver pay',
      totalMiles * profile.driverCpm,
      `${Math.round(totalMiles)} mi × $${profile.driverCpm.toFixed(2)}/mi`,
      'driver',
    );
  } else if (profile.driverPayMode === 'percent-of-linehaul') {
    add(
      'driver-pay',
      'Driver pay',
      linehaul * (profile.driverPercent / 100),
      `${profile.driverPercent}% of $${money(linehaul).toLocaleString()} linehaul`,
      'driver',
    );
  }

  add(
    'per-diem',
    'Meals / per diem',
    hos.tripDays * profile.perDiemPerDay,
    `${hos.tripDays} day${hos.tripDays > 1 ? 's' : ''} × $${profile.perDiemPerDay} (IRS transportation-worker rate)`,
    'driver',
    { outOfPocket: true },
  );

  // --- Trip-specific spend -------------------------------------------------
  add(
    'tolls',
    'Tolls',
    route.tollEstimate,
    `Estimated across ${route.states.join(', ')}`,
    'trip',
    { outOfPocket: true, reimbursable: true },
  );

  if (hos.nightsOut > 0) {
    add(
      'parking',
      'Truck parking',
      hos.nightsOut * TRIP_COSTS.parkingPerNight,
      `${hos.nightsOut} night${hos.nightsOut > 1 ? 's' : ''} × $${TRIP_COSTS.parkingPerNight} reserved space`,
      'trip',
      { outOfPocket: true },
    );
  }

  const weighs = input.hazmat || input.oversize || input.grossWeightLbs > 78000 ? 2 : 1;
  add(
    'scale',
    'Scale tickets',
    TRIP_COSTS.catScaleWeigh + (weighs - 1) * TRIP_COSTS.catScaleReweigh,
    weighs > 1
      ? `Weigh $${TRIP_COSTS.catScaleWeigh} + reweigh $${TRIP_COSTS.catScaleReweigh} — heavy or placarded load`
      : `One CAT scale weigh @ $${TRIP_COSTS.catScaleWeigh}`,
    'trip',
    { outOfPocket: true },
  );

  if (input.lumperExpected) {
    const lumper = input.lumperEstimate > 0 ? input.lumperEstimate : TRIP_COSTS.lumperTypical;
    add(
      'lumper',
      'Lumper fee',
      lumper,
      'Paid at the receiver, out of your pocket. Get a receipt — this is reimbursable but you float it.',
      'trip',
      { outOfPocket: true, reimbursable: true },
    );
  }

  if (input.equipment === 'reefer') {
    add(
      'washout',
      'Trailer washout',
      TRIP_COSTS.reeferWashout,
      'Required between food-grade loads. Keep the ticket.',
      'trip',
      { outOfPocket: true, reimbursable: true },
    );
  }

  if (input.oversize) {
    add(
      'escort',
      'Pilot / escort car',
      totalMiles * TRIP_COSTS.escortPerMile,
      `${Math.round(totalMiles)} mi × $${TRIP_COSTS.escortPerMile}/mi`,
      'trip',
      { outOfPocket: true, reimbursable: true },
    );
  }

  // --- Compliance ----------------------------------------------------------
  if (input.hazmat) {
    add(
      'hazmat',
      'Hazmat compliance',
      TRIP_COSTS.hazmatPerTrip,
      'Placards, shipping papers, segregation check, share of annual hazmat registration',
      'compliance',
      { outOfPocket: true },
    );
  }

  const permitCost = restrictions.restrictions
    .filter((r) => r.kind === 'oversize-permit' || r.kind === 'weight-limit')
    .reduce((s, r) => s + r.costUsd, 0);
  add(
    'permits',
    'Trip permits',
    permitCost,
    'Oversize / overweight permits, per state crossed',
    'compliance',
    { outOfPocket: true, reimbursable: true },
  );

  const chainCost = restrictions.restrictions
    .filter((r) => r.kind === 'chain-law')
    .reduce((s, r) => s + r.costUsd, 0);
  add(
    'chains',
    'Chain allowance',
    chainCost,
    'Amortized chains plus the time to hang them in chain-law states',
    'compliance',
  );

  // --- Money off the top ---------------------------------------------------
  // Fuel surcharge uses the industry-standard peg against a base diesel price.
  const fscPerMile = Math.max(0, fuel.blendedPricePerGal - TRIP_COSTS.fscBaseDieselPrice) / Math.max(1, profile.mpg);
  const fsc = fscPerMile * loadedMiles;
  const grossRevenue = linehaul + fsc;

  add(
    'factoring',
    'Factoring fee',
    grossRevenue * (profile.factoringPercent / 100),
    `${profile.factoringPercent}% of $${money(grossRevenue).toLocaleString()} gross`,
    'business',
  );
  add(
    'dispatch',
    'Dispatch fee',
    linehaul * (profile.dispatchPercent / 100),
    `${profile.dispatchPercent}% of linehaul`,
    'business',
  );

  // --- Contingency ---------------------------------------------------------
  const hardCosts = lines.reduce((s, l) => s + l.amount, 0);
  const contingencyRate = CONTINGENCY_BY_RISK[riskLevel];
  add(
    'contingency',
    'Contingency reserve',
    hardCosts * contingencyRate,
    `${(contingencyRate * 100).toFixed(0)}% of hard costs at ${riskLevel} risk — breakdowns, reroutes, a lost day`,
    'contingency',
    { outOfPocket: true },
  );

  // --- Unplanned costs entered by the user --------------------------------
  // These land after the contingency reserve on purpose: the reserve covers
  // what might happen, these are what did happen. Both belong in the total.
  for (const c of addedCosts) {
    add(
      `added-${c.id}`,
      c.label || 'Unplanned cost',
      c.amount,
      [c.note, c.reimbursable ? 'Reimbursable — keep the receipt.' : null]
        .filter(Boolean)
        .join(' ') || 'Entered by the user.',
      'incident',
      { outOfPocket: c.outOfPocket, reimbursable: c.reimbursable },
    );
  }

  // --- Revenue -------------------------------------------------------------
  const revenue: RevenueLine[] = [
    {
      key: 'linehaul',
      label: 'Linehaul',
      amount: money(linehaul),
      basis:
        input.rateMode === 'flat'
          ? `Flat rate for ${Math.round(loadedMiles)} loaded mi`
          : `$${input.rate.toFixed(2)}/mi × ${Math.round(loadedMiles)} loaded mi`,
      contingent: false,
    },
  ];

  if (fsc > 0) {
    revenue.push({
      key: 'fsc',
      label: 'Fuel surcharge',
      amount: money(fsc),
      basis: `($${fuel.blendedPricePerGal.toFixed(2)} − $${TRIP_COSTS.fscBaseDieselPrice.toFixed(2)}) ÷ ${profile.mpg} mpg = $${fscPerMile.toFixed(3)}/mi`,
      contingent: false,
    });
  }

  if (input.stops.length > 0) {
    revenue.push({
      key: 'stop-off',
      label: 'Stop-off pay',
      amount: money(input.stops.length * TRIP_COSTS.stopOffPay),
      basis: `${input.stops.length} extra stop${input.stops.length > 1 ? 's' : ''} × $${TRIP_COSTS.stopOffPay} — confirm it is on the rate confirmation`,
      contingent: true,
    });
  }

  if (input.equipment === 'flatbed') {
    revenue.push({
      key: 'tarp',
      label: 'Tarp pay',
      amount: TRIP_COSTS.tarpPay,
      basis: 'Standard tarp pay if the load requires tarping',
      contingent: true,
    });
  }

  revenue.push({
    key: 'detention',
    label: 'Detention (if held)',
    amount: money(TRIP_COSTS.detentionPerHour * 2),
    basis: `$${TRIP_COSTS.detentionPerHour}/hr after ${TRIP_COSTS.detentionFreeHours} free hours — assumes 2 hours billed`,
    contingent: true,
  });

  // --- Totals --------------------------------------------------------------
  const totalCost = money(lines.reduce((s, l) => s + l.amount, 0));
  const committedRevenue = money(
    revenue.filter((r) => !r.contingent).reduce((s, r) => s + r.amount, 0),
  );
  const potentialRevenue = money(revenue.reduce((s, r) => s + r.amount, 0));
  const netProfit = money(committedRevenue - totalCost);
  const cashToFloat = money(
    lines.filter((l) => l.outOfPocket).reduce((s, l) => s + l.amount, 0),
  );

  return {
    lines,
    revenue,
    totalCost,
    committedRevenue,
    potentialRevenue,
    netProfit,
    profitPerMile: money(netProfit / totalMiles),
    costPerMile: money(totalCost / totalMiles),
    revenuePerMile: money(committedRevenue / loadedMiles),
    allInRatePerMile: money(committedRevenue / totalMiles),
    breakEvenRatePerMile: money(totalCost / loadedMiles),
    marginPercent: committedRevenue > 0 ? money((netProfit / committedRevenue) * 100) : 0,
    cashToFloat,
    profitPerDay: money(netProfit / Math.max(0.5, hos.totalElapsedHours / 24)),
  };
}
