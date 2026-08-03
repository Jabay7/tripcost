import type { TruckProfile } from '../types';

/**
 * Default cost basis for a single-truck owner-operator.
 *
 * Baseline figures are anchored to ATRI's "Analysis of the Operational Costs of
 * Trucking", the industry's standard cost study, which reports an average
 * marginal cost around $2.25–2.30 per mile for a company truck:
 *
 *   Fuel                 ~$0.55/mi      Repair & maintenance   ~$0.20/mi
 *   Truck/trailer pmt    ~$0.36/mi      Tires                  ~$0.046/mi
 *   Insurance            ~$0.10/mi      Permits & licensing    ~$0.037/mi
 *   Tolls                ~$0.036/mi     Driver wage + benefits ~$0.93/mi
 *
 * An owner-operator's sheet differs in one important way: there is no driver
 * wage line — what would be wage is what you take home. So the default profile
 * below uses `driverPayMode: 'owner-operator'`, and the app reports profit
 * rather than burying the driver's money in cost. Fleets running company
 * drivers should switch the mode and set a CPM or percentage.
 *
 * Every number here is editable in the Truck tab. These are starting points,
 * not truths — a driver's own settlement statements always win.
 */
export const DEFAULT_PROFILE: TruckProfile = {
  label: 'My Truck',

  // Performance — a well-spec'd modern sleeper loaded to ~65k lbs.
  mpg: 6.5,
  tankGallons: 250,
  avgSpeedMph: 52, // Honest door-to-door average once scales and traffic count.
  reeferGalPerHour: 0.65, // Continuous run is ~0.9; start-stop ~0.4.
  idleGalPerHour: 0.9, // Main engine idle. An APU is ~0.2.
  defFraction: 0.025, // DEF is 2–3% of diesel burned.
  defPricePerGal: 3.6,

  // Fixed monthly costs.
  truckPaymentMo: 2200,
  trailerPaymentMo: 600,
  insuranceMo: 1050, // Primary liability + cargo + physical damage + occ/acc.
  permitsLicensingMo: 250, // IRP plates, 2290 HVUT, UCR, IFTA, FMCSA — annualized.
  eldTelematicsMo: 45,
  accountingLegalMo: 150,
  overheadMo: 200, // Phone, tools, home parking, subscriptions.
  workingDaysPerMonth: 22,

  // Variable per-mile costs.
  tiresCpm: 0.046,
  maintenanceCpm: 0.2,

  // Driver.
  driverPayMode: 'owner-operator',
  driverCpm: 0.65,
  driverPercent: 27,
  perDiemPerDay: 80, // IRS special per-diem rate for transportation workers.

  // Money taken off the top of every settlement.
  factoringPercent: 2.5,
  dispatchPercent: 0,

  // Hours of service.
  hosCycle: 70,
  hoursAlreadyOnDuty: 0,
};

/**
 * Trip-level cost constants.
 *
 * These are the line items that never show up in a per-mile average but empty
 * a driver's wallet in practice — the ones an owner-operator gets surprised by.
 */
export const TRIP_COSTS = {
  /** CAT scale first weigh; reweigh on the same ticket is cheaper. */
  catScaleWeigh: 16.0,
  catScaleReweigh: 4.5,
  /** Reserved truck parking. Free lots fill by 1600 in most markets. */
  parkingPerNight: 20.0,
  /** Grocery and retail DC lumpers. Fronted by the driver, usually reimbursed. */
  lumperTypical: 250.0,
  /** Trailer washout — required between food-grade and most reefer loads. */
  reeferWashout: 75.0,
  /** Oversize/overweight permit, per state crossed. */
  oversizePermitPerState: 35.0,
  /** Pilot/escort car when the load requires one. */
  escortPerMile: 2.25,
  /** Placards, shipping papers, segregation compliance, hazmat registration share. */
  hazmatPerTrip: 50.0,
  /** Amortized cost of chains and the time to hang them, in chain-law season. */
  chainUpAllowance: 45.0,
  /** Scale/inspection time and roadside fees allowance. */
  inspectionAllowance: 0.0,

  // --- Accessorial revenue (money owed to you) ---
  /** Detention after the free window, per hour. */
  detentionPerHour: 50.0,
  detentionFreeHours: 2,
  /** Extra pickup or drop beyond the first and last. */
  stopOffPay: 75.0,
  /** Truck Ordered Not Used. */
  tonu: 200.0,
  layoverPerDay: 200.0,
  /** Flatbed tarping. */
  tarpPay: 100.0,

  /** Industry-standard peg for fuel surcharge calculations. */
  fscBaseDieselPrice: 1.25,
} as const;

/**
 * Contingency reserve as a fraction of hard costs, scaled by the trip's risk
 * score. A green run carries a small buffer; a red run through a winter
 * mountain pass should carry real money for a tow, a motel, or a lost day.
 */
export const CONTINGENCY_BY_RISK = {
  GREEN: 0.02,
  AMBER: 0.05,
  RED: 0.09,
} as const;
