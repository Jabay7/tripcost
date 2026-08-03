import { CATEGORY_LABELS } from '../data/incidents';
import type {
  ComplianceAlert,
  CostBucket,
  Driver,
  DriverCostSummary,
  FleetCostReport,
  LedgerEntry,
  Period,
  Truck,
  TruckCostSummary,
} from '../types';

export const driverName = (d: Driver): string =>
  `${d.firstName} ${d.lastName}`.trim() || 'Unnamed driver';

/**
 * CDL and DOT medical certificates coming due.
 *
 * This is the unglamorous half of dispatch: a driver whose medical card lapsed
 * yesterday is not a driver, and the carrier — not the driver — wears the
 * violation. Warning at 60 days gives time to get an appointment; 30 days is
 * where it becomes urgent; past the date it is a hard stop.
 */
export function complianceAlerts(drivers: Driver[], today: Date): ComplianceAlert[] {
  const out: ComplianceAlert[] = [];
  const startOfToday = new Date(today).setHours(0, 0, 0, 0);

  for (const d of drivers) {
    if (d.status === 'inactive') continue;

    const check = (kind: 'cdl' | 'medical', iso: string, label: string) => {
      if (!iso) return;
      const expiry = new Date(iso).getTime();
      if (Number.isNaN(expiry)) return;
      const daysRemaining = Math.floor((expiry - startOfToday) / 86_400_000);
      if (daysRemaining > 60) return;

      const severity: ComplianceAlert['severity'] =
        daysRemaining < 0 ? 'expired' : daysRemaining <= 30 ? 'critical' : 'warning';

      out.push({
        driverId: d.id,
        driverName: driverName(d),
        kind,
        expiresOn: iso,
        daysRemaining,
        severity,
        message:
          daysRemaining < 0
            ? `${label} expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago. This driver cannot legally operate.`
            : `${label} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
      });
    };

    check('cdl', d.cdlExpires, 'CDL');
    check('medical', d.medicalCardExpires, 'DOT medical card');
  }

  const rank = { expired: 0, critical: 1, warning: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.daysRemaining - b.daysRemaining);
}

const money = (n: number) => Math.round(n * 100) / 100;
const DAYS_PER_MONTH = 30.44;

/**
 * ATRI's reported average marginal cost of operating a truck, per mile. Used
 * only as a benchmark line in the insights — a fleet's own numbers always win.
 */
export const INDUSTRY_BENCHMARK_CPM = 2.27;

/**
 * The driver wage and benefits portion of that benchmark.
 *
 * An owner-operator profile has no wage line — what would be wage is what they
 * take home — so comparing their cost per mile against the full figure makes
 * them look roughly a dollar cheaper than any fleet alive. Subtract this to
 * compare like with like.
 */
export const INDUSTRY_DRIVER_CPM = 0.93;

export const PERIOD_DAYS: Record<Period, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 91,
  year: 365,
};

export const PERIOD_LABELS: Record<Period, string> = {
  day: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 91 days',
  year: 'Last 365 days',
};

/**
 * Rolling window ending at `anchor`. Rolling rather than calendar-aligned so a
 * report run on the 3rd of the month is still a full month of cost, not three
 * days of it.
 */
export function periodBounds(period: Period, anchor: Date): { from: Date; to: Date; days: number } {
  const days = PERIOD_DAYS[period];
  const to = new Date(anchor);
  const from = new Date(anchor.getTime() - (days - 1) * 86_400_000);
  return { from, to, days };
}

function inWindow(entry: LedgerEntry, from: Date, to: Date): boolean {
  const t = new Date(entry.date).getTime();
  // Compare on whole days so a same-day entry always counts.
  return t >= new Date(from).setHours(0, 0, 0, 0) && t <= new Date(to).setHours(23, 59, 59, 999);
}

/**
 * Costs a single truck over a window.
 *
 * The model is deliberately split the way a fleet's books are:
 *
 *   Fixed     accrues on calendar days. The truck payment is due whether the
 *             truck turned a wheel or not. This is why idle trucks bleed.
 *   Variable  accrues on miles — fuel, DEF, tires, maintenance.
 *   Incident  is not modeled at all. It is whatever was actually recorded in
 *             the ledger for this truck in this window.
 *
 * Revenue prefers recorded ledger entries. When none exist for the window, it
 * falls back to the truck's planned utilization so a new fleet still gets a
 * meaningful projection on day one.
 */
export function summarizeTruck(
  truck: Truck,
  from: Date,
  to: Date,
  days: number,
  ledger: LedgerEntry[],
  fuelPricePerGal: number,
  drivers: Driver[] = [],
): TruckCostSummary {
  const assigned = drivers.filter((d) => d.assignedTruckId === truck.id);
  const p = truck.profile;
  const entries = ledger.filter((e) => e.truckId === truck.id && inWindow(e, from, to));

  const expenses = entries.filter((e) => e.kind === 'expense');
  const revenues = entries.filter((e) => e.kind === 'revenue');

  // --- Miles ---------------------------------------------------------------
  const recordedMiles = entries.reduce((s, e) => s + (e.miles || 0), 0);
  const workingDays = truck.active ? days * (p.workingDaysPerMonth / DAYS_PER_MONTH) : 0;
  const projectedMiles = workingDays * truck.plannedMilesPerDay;
  const miles = recordedMiles > 0 ? recordedMiles : projectedMiles;
  const safeMiles = Math.max(1, miles);

  // --- Fixed ---------------------------------------------------------------
  const monthlyFixed =
    p.truckPaymentMo +
    p.trailerPaymentMo +
    p.insuranceMo +
    p.permitsLicensingMo +
    p.eldTelematicsMo +
    p.accountingLegalMo +
    p.overheadMo;
  const fixedCost = (monthlyFixed / DAYS_PER_MONTH) * days;

  // --- Fuel ----------------------------------------------------------------
  const gallons = miles / Math.max(1, p.mpg);
  const dieselCost = gallons * fuelPricePerGal;
  const defCost = gallons * p.defFraction * p.defPricePerGal;
  const fuelCost = dieselCost + defCost;

  // --- Other variable ------------------------------------------------------
  const tireCost = miles * p.tiresCpm;
  const maintCost = miles * p.maintenanceCpm;
  const variableCost = tireCost + maintCost;

  // --- Driver --------------------------------------------------------------
  let driverCost = 0;
  if (p.driverPayMode === 'per-mile') driverCost = miles * p.driverCpm;
  else if (p.driverPayMode === 'percent-of-linehaul') {
    const projRev = miles * truck.targetRatePerMile;
    driverCost = projRev * (p.driverPercent / 100);
  }

  // --- Incidents (actual, from the ledger) ---------------------------------
  const incidentCost = expenses.reduce((s, e) => s + e.amount, 0);

  const totalCost = fixedCost + fuelCost + variableCost + driverCost + incidentCost;

  // --- Revenue -------------------------------------------------------------
  const recordedRevenue = revenues.reduce((s, e) => s + e.amount, 0);
  const revenue = recordedRevenue > 0 ? recordedRevenue : projectedMiles * truck.targetRatePerMile;

  const netProfit = revenue - totalCost;

  // --- Buckets -------------------------------------------------------------
  const bucket = (label: string, amount: number, category: CostBucket['category']): CostBucket => ({
    label,
    amount: money(amount),
    perMile: money(amount / safeMiles),
    perDay: money(amount / Math.max(1, days)),
    category,
  });

  const buckets: CostBucket[] = [
    bucket('Truck & trailer payment', ((p.truckPaymentMo + p.trailerPaymentMo) / DAYS_PER_MONTH) * days, 'fixed'),
    bucket('Insurance', (p.insuranceMo / DAYS_PER_MONTH) * days, 'fixed'),
    bucket('Permits & licensing', (p.permitsLicensingMo / DAYS_PER_MONTH) * days, 'fixed'),
    bucket('ELD & telematics', (p.eldTelematicsMo / DAYS_PER_MONTH) * days, 'fixed'),
    bucket('Accounting & legal', (p.accountingLegalMo / DAYS_PER_MONTH) * days, 'fixed'),
    bucket('Overhead', (p.overheadMo / DAYS_PER_MONTH) * days, 'fixed'),
    bucket('Diesel', dieselCost, 'fuel'),
    bucket('DEF', defCost, 'fuel'),
    bucket('Tires', tireCost, 'variable'),
    bucket('Maintenance & repair', maintCost, 'variable'),
  ];
  if (driverCost > 0) buckets.push(bucket('Driver pay', driverCost, 'driver'));

  // One bucket per incident category actually seen, so the report shows where
  // the unplanned money went rather than a single opaque line.
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }
  for (const [cat, amt] of byCategory) {
    const label = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat;
    buckets.push(bucket(label, amt, 'incident'));
  }

  buckets.sort((a, b) => b.amount - a.amount);

  return {
    truckId: truck.id,
    title: truck.nickname
      ? `Unit ${truck.unitNumber} — ${truck.nickname}`
      : `Unit ${truck.unitNumber}`,
    subtitle:
      [
        truck.year || null,
        truck.make,
        truck.model,
        assigned.length > 0 ? `· ${assigned.map(driverName).join(' / ')}` : '· Unassigned',
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || 'No equipment details',
    active: truck.active,
    days,
    miles: Math.round(miles),
    fixedCost: money(fixedCost),
    fuelCost: money(fuelCost),
    variableCost: money(variableCost),
    driverCost: money(driverCost),
    incidentCost: money(incidentCost),
    totalCost: money(totalCost),
    costPerMile: money(totalCost / safeMiles),
    costPerDay: money(totalCost / Math.max(1, days)),
    fixedCostPerDay: money(fixedCost / Math.max(1, days)),
    revenue: money(revenue),
    netProfit: money(netProfit),
    profitPerMile: money(netProfit / safeMiles),
    profitPerDay: money(netProfit / Math.max(1, days)),
    operatingRatio: revenue > 0 ? money((totalCost / revenue) * 100) : 0,
    marginPercent: revenue > 0 ? money((netProfit / revenue) * 100) : 0,
    breakEvenRatePerMile: money(totalCost / safeMiles),
    buckets,
    incidentCount: expenses.length,
    driverNames: assigned.map(driverName),
  };
}

/**
 * Rolls truck cost up to the driver.
 *
 * A driver's economics are their truck's economics — they burn that unit's fuel
 * at that unit's mpg and carry that unit's payment. When a team shares a truck,
 * its cost is split evenly between them rather than double-counted.
 */
function summarizeDrivers(
  drivers: Driver[],
  truckSummaries: TruckCostSummary[],
  trucks: Truck[],
  days: number,
): DriverCostSummary[] {
  return drivers.map((d) => {
    const truck = trucks.find((t) => t.id === d.assignedTruckId);
    const summary = truckSummaries.find((s) => s.truckId === d.assignedTruckId);
    const teamSize = Math.max(
      1,
      drivers.filter((x) => x.assignedTruckId && x.assignedTruckId === d.assignedTruckId).length,
    );

    const share = (n: number) => money(n / teamSize);
    const miles = summary ? Math.round(summary.miles / teamSize) : 0;
    const totalCost = summary ? share(summary.totalCost) : 0;
    const revenue = summary ? share(summary.revenue) : 0;

    return {
      driverId: d.id,
      name: driverName(d),
      status: d.status,
      truckId: d.assignedTruckId,
      truckLabel: truck ? `Unit ${truck.unitNumber}` : 'Unassigned',
      days,
      miles,
      totalCost,
      revenue,
      netProfit: money(revenue - totalCost),
      costPerMile: money(totalCost / Math.max(1, miles)),
      revenuePerMile: money(revenue / Math.max(1, miles)),
      operatingRatio: revenue > 0 ? money((totalCost / revenue) * 100) : 0,
      incidentCost: summary ? share(summary.incidentCost) : 0,
      incidentCount: summary ? summary.incidentCount : 0,
    };
  });
}

/** Sums a set of per-truck summaries into one combined view. */
function combine(summaries: TruckCostSummary[], days: number, label: string): TruckCostSummary {
  const sum = (f: (s: TruckCostSummary) => number) => summaries.reduce((a, s) => a + f(s), 0);

  const miles = sum((s) => s.miles);
  const safeMiles = Math.max(1, miles);
  const totalCost = sum((s) => s.totalCost);
  const revenue = sum((s) => s.revenue);
  const netProfit = revenue - totalCost;
  const fixedCost = sum((s) => s.fixedCost);

  // Merge buckets by label so the combined view rolls up cleanly.
  const merged = new Map<string, CostBucket>();
  for (const s of summaries) {
    for (const b of s.buckets) {
      const cur = merged.get(b.label);
      if (cur) cur.amount = money(cur.amount + b.amount);
      else merged.set(b.label, { ...b });
    }
  }
  const buckets = [...merged.values()]
    .map((b) => ({
      ...b,
      perMile: money(b.amount / safeMiles),
      perDay: money(b.amount / Math.max(1, days)),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    truckId: '__combined__',
    title: label,
    subtitle: `${summaries.length} truck${summaries.length === 1 ? '' : 's'}`,
    active: true,
    days,
    miles,
    fixedCost: money(fixedCost),
    fuelCost: money(sum((s) => s.fuelCost)),
    variableCost: money(sum((s) => s.variableCost)),
    driverCost: money(sum((s) => s.driverCost)),
    incidentCost: money(sum((s) => s.incidentCost)),
    totalCost: money(totalCost),
    costPerMile: money(totalCost / safeMiles),
    costPerDay: money(totalCost / Math.max(1, days)),
    fixedCostPerDay: money(fixedCost / Math.max(1, days)),
    revenue: money(revenue),
    netProfit: money(netProfit),
    profitPerMile: money(netProfit / safeMiles),
    profitPerDay: money(netProfit / Math.max(1, days)),
    operatingRatio: revenue > 0 ? money((totalCost / revenue) * 100) : 0,
    marginPercent: revenue > 0 ? money((netProfit / revenue) * 100) : 0,
    breakEvenRatePerMile: money(totalCost / safeMiles),
    buckets,
    incidentCount: sum((s) => s.incidentCount),
    driverNames: summaries.flatMap((s) => s.driverNames),
  };
}

/**
 * Builds the fleet report.
 *
 * `selectedTruckIds` scopes the headline numbers — this is what answers
 * "how much are these 3 trucks costing me out of the whole fleet?". The full
 * fleet is still costed underneath so the report can express the selection as a
 * share of the whole.
 */
export function buildFleetReport(
  trucks: Truck[],
  ledger: LedgerEntry[],
  period: Period,
  selectedTruckIds: string[],
  fuelPricePerGal: number,
  anchor: Date,
  drivers: Driver[] = [],
): FleetCostReport {
  const { from, to, days } = periodBounds(period, anchor);

  const allSummaries = trucks.map((t) =>
    summarizeTruck(t, from, to, days, ledger, fuelPricePerGal, drivers),
  );
  const fleetTotalCost = allSummaries.reduce((s, x) => s + x.totalCost, 0);

  const selected =
    selectedTruckIds.length > 0
      ? allSummaries.filter((s) => selectedTruckIds.includes(s.truckId))
      : allSummaries;

  const isSubset = selected.length !== allSummaries.length && selected.length > 0;
  const combined = combine(
    selected,
    days,
    isSubset ? `Selected — ${selected.length} of ${trucks.length} trucks` : 'Whole fleet',
  );

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    days,
    selectedTruckIds: selected.map((s) => s.truckId),
    fleetSize: trucks.length,
    perTruck: selected,
    perDriver: summarizeDrivers(
      // Only drivers on the selected trucks, so the two views agree.
      drivers.filter((d) => !d.assignedTruckId || selected.some((s) => s.truckId === d.assignedTruckId)),
      selected,
      trucks,
      days,
    ),
    complianceAlerts: complianceAlerts(drivers, anchor),
    combined,
    shareOfFleetCost: fleetTotalCost > 0 ? money((combined.totalCost / fleetTotalCost) * 100) : 0,
    fleetTotalCost: money(fleetTotalCost),
    insights: buildInsights(
      selected,
      combined,
      days,
      trucks.length,
      complianceAlerts(drivers, anchor),
      drivers,
    ),
  };
}

function buildInsights(
  perTruck: TruckCostSummary[],
  combined: TruckCostSummary,
  days: number,
  fleetSize: number,
  alerts: ComplianceAlert[] = [],
  drivers: Driver[] = [],
): string[] {
  const out: string[] = [];
  if (perTruck.length === 0) return ['No trucks selected.'];

  const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

  out.push(
    `${perTruck.length === fleetSize ? 'The fleet' : `These ${perTruck.length} truck${perTruck.length === 1 ? '' : 's'}`} ` +
      `cost ${usd(combined.totalCost)} over ${days} day${days === 1 ? '' : 's'} — ` +
      `${usd(combined.costPerDay)}/day, $${combined.costPerMile.toFixed(3)}/mile across ${combined.miles.toLocaleString()} miles.`,
  );

  // Operating ratio is the number an owner should be watching.
  if (combined.revenue > 0) {
    const or = combined.operatingRatio;
    const verdict =
      or >= 100
        ? 'losing money — every mile costs more than it earns'
        : or >= 95
          ? 'thin; there is little room for a bad month'
          : or >= 90
            ? 'healthy'
            : 'strong';
    out.push(`Operating ratio is ${or.toFixed(1)}% — ${verdict}. Net ${usd(combined.netProfit)} (${combined.marginPercent.toFixed(1)}% margin).`);
  }

  // Fixed cost burden — the thing that punishes idle trucks.
  out.push(
    `Fixed overhead runs ${usd(combined.fixedCostPerDay)}/day whether the truck${perTruck.length === 1 ? '' : 's'} roll${perTruck.length === 1 ? 's' : ''} or not. ` +
      `That is ${usd(combined.fixedCostPerDay * 7)} a week of standing cost.`,
  );

  if (perTruck.length > 1) {
    const worst = perTruck.reduce((a, b) => (b.costPerMile > a.costPerMile ? b : a));
    const best = perTruck.reduce((a, b) => (b.costPerMile < a.costPerMile ? b : a));
    if (worst.truckId !== best.truckId) {
      const gap = worst.costPerMile - best.costPerMile;
      out.push(
        `${worst.title} is your most expensive at $${worst.costPerMile.toFixed(3)}/mi, ` +
          `${best.title} the cheapest at $${best.costPerMile.toFixed(3)}/mi — a $${gap.toFixed(3)}/mi spread. ` +
          `At ${worst.miles.toLocaleString()} miles that gap is worth ${usd(gap * worst.miles)}.`,
      );
    }

    const losers = perTruck.filter((t) => t.revenue > 0 && t.netProfit < 0);
    if (losers.length > 0) {
      out.push(
        `${losers.map((l) => l.title).join(', ')} ${losers.length === 1 ? 'is' : 'are'} running at a loss this period.`,
      );
    }
  }

  if (combined.incidentCount > 0) {
    const share = combined.totalCost > 0 ? (combined.incidentCost / combined.totalCost) * 100 : 0;
    out.push(
      `${combined.incidentCount} unplanned event${combined.incidentCount === 1 ? '' : 's'} added ${usd(combined.incidentCost)} ` +
        `(${share.toFixed(1)}% of total cost, $${(combined.incidentCost / Math.max(1, combined.miles)).toFixed(3)}/mi).`,
    );
    const perEventMiles = combined.miles / combined.incidentCount;
    if (combined.miles > 0) {
      out.push(
        perEventMiles < 10000
          ? `That is one event every ${Math.round(perEventMiles).toLocaleString()} miles — worse than the 10,000–15,000 mile industry norm. Look at the maintenance program, not luck.`
          : `That is one event every ${Math.round(perEventMiles).toLocaleString()} miles, in line with or better than the 10,000–15,000 mile industry norm.`,
      );
    }
  } else {
    out.push('No unplanned costs recorded this period. Log tows, road calls and citations as they happen to keep this honest.');
  }

  // Compare like with like: a profile with no driver wage line must be measured
  // against the benchmark with its wage component removed.
  const paysDriverWage = combined.driverCost > 0;
  const benchmark = paysDriverWage
    ? INDUSTRY_BENCHMARK_CPM
    : INDUSTRY_BENCHMARK_CPM - INDUSTRY_DRIVER_CPM;
  const delta = combined.costPerMile - benchmark;
  out.push(
    `Against a ~$${benchmark.toFixed(2)}/mi industry benchmark, you are ` +
      `${delta >= 0 ? `$${delta.toFixed(3)} above` : `$${Math.abs(delta).toFixed(3)} below`}` +
      (paysDriverWage
        ? '.'
        : ' — driver wage excluded on both sides, since this profile pays the owner out of profit rather than as a cost.'),
  );

  if (!paysDriverWage) {
    out.push(
      `Note: with no wage line, the operating ratio above counts your own labor as profit. ` +
        `A company fleet running the same trucks would show a materially higher ratio.`,
    );
  }

  out.push(
    `Break-even: you must book at least $${combined.breakEvenRatePerMile.toFixed(3)}/mile to cover cost. ` +
      `Anything under that is a load you are paying to haul.`,
  );

  // --- Roster and compliance ----------------------------------------------
  const expired = alerts.filter((a) => a.severity === 'expired');
  const critical = alerts.filter((a) => a.severity === 'critical');
  if (expired.length > 0) {
    out.push(
      `${expired.length} compliance item${expired.length === 1 ? ' is' : 's are'} already expired — ` +
        `${[...new Set(expired.map((a) => a.driverName))].join(', ')}. Those drivers cannot legally operate.`,
    );
  } else if (critical.length > 0) {
    out.push(
      `${critical.length} CDL or medical certificate${critical.length === 1 ? '' : 's'} expire${critical.length === 1 ? 's' : ''} within 30 days. Book the appointments now.`,
    );
  }

  const activeDrivers = drivers.filter((d) => d.status === 'active');
  const unassigned = activeDrivers.filter((d) => !d.assignedTruckId);
  if (unassigned.length > 0) {
    out.push(
      `${unassigned.length} active driver${unassigned.length === 1 ? '' : 's'} ` +
        `(${unassigned.map(driverName).join(', ')}) ${unassigned.length === 1 ? 'is' : 'are'} not assigned to a unit.`,
    );
  }

  const seatedTrucks = perTruck.filter((t) => t.driverNames.length > 0).length;
  const emptyTrucks = perTruck.filter((t) => t.active && t.driverNames.length === 0);
  if (emptyTrucks.length > 0) {
    out.push(
      `${emptyTrucks.length} active truck${emptyTrucks.length === 1 ? '' : 's'} ` +
        `(${emptyTrucks.map((t) => t.title).join(', ')}) ${emptyTrucks.length === 1 ? 'has' : 'have'} no driver assigned ` +
        `but still cost ${usd(emptyTrucks.reduce((s, t) => s + t.fixedCost, 0))} in fixed overhead this period.`,
    );
  } else if (seatedTrucks > 0) {
    out.push(`All ${seatedTrucks} truck${seatedTrucks === 1 ? ' is' : 's are'} seated.`);
  }

  return out;
}
