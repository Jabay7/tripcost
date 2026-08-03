/**
 * Core domain types for TripCost.
 *
 * Vocabulary follows the trucking industry, not software:
 *  - "linehaul"   the base freight rate, before fuel surcharge and accessorials
 *  - "deadhead"   empty miles driven to get to the shipper
 *  - "lumper"     third-party unloading fee, usually fronted by the driver
 *  - "TONU"       Truck Ordered Not Used
 *  - "CPM"        cost per mile
 *  - "FSC"        fuel surcharge
 */

export type LatLng = { lat: number; lon: number };

export type Place = LatLng & {
  id: string;
  /** Display form, e.g. "Laredo, TX" */
  name: string;
  city: string;
  /** Two-letter USPS abbreviation */
  state: StateCode;
};

export type StateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC';

/** EIA petroleum region. Diesel is priced and reported by these. */
export type PaddRegion =
  | 'NEW_ENGLAND'
  | 'CENTRAL_ATLANTIC'
  | 'LOWER_ATLANTIC'
  | 'MIDWEST'
  | 'GULF_COAST'
  | 'ROCKY_MOUNTAIN'
  | 'WEST_COAST'
  | 'CALIFORNIA';

// ---------------------------------------------------------------------------
// Trip input
// ---------------------------------------------------------------------------

export type EquipmentType = 'dry-van' | 'reefer' | 'flatbed' | 'tanker' | 'hopper';

export type HazmatClass =
  | '1-explosives'
  | '2-gases'
  | '3-flammable-liquid'
  | '4-flammable-solid'
  | '5-oxidizer'
  | '6-toxic'
  | '7-radioactive'
  | '8-corrosive'
  | '9-misc';

export type TripInput = {
  origin: Place;
  destination: Place;
  /** Intermediate pickup/drop stops, in order. */
  stops: Place[];
  /** Empty miles to get to the shipper. Real cost, zero revenue. */
  deadheadMiles: number;
  /** ISO-8601 departure timestamp. */
  departAt: string;

  equipment: EquipmentType;
  grossWeightLbs: number;

  /** Linehaul revenue. Interpreted per `rateMode`. */
  rate: number;
  rateMode: 'flat' | 'per-mile';

  hazmat: HazmatClass | null;
  /** Reefer set point in Fahrenheit. Null means the unit runs off. */
  reeferSetPointF: number | null;
  oversize: boolean;

  /** Driver expects to pay a lumper at the receiver. */
  lumperExpected: boolean;
  lumperEstimate: number;

  /** Appointment the load must be delivered by, ISO-8601. Null = no hard deadline. */
  deliverBy: string | null;

  /** Which truck in the fleet is running this load. */
  truckId?: string;
};

// ---------------------------------------------------------------------------
// User-added costs — the things no model predicts
// ---------------------------------------------------------------------------

export type AddedCostCategory =
  | 'tow'
  | 'tire'
  | 'breakdown'
  | 'roadside'
  | 'fine'
  | 'lodging'
  | 'permit'
  | 'fuel'
  | 'labor'
  | 'claim'
  | 'other';

/**
 * An unplanned cost the driver or dispatcher enters by hand — a tow, a blown
 * steer tire, a citation, a motel night while the truck is in the shop.
 * These flow into both the trip's total and the fleet ledger.
 */
export type AddedCost = {
  id: string;
  label: string;
  amount: number;
  category: AddedCostCategory;
  note: string;
  /** Driver paid cash or personal card. Counts toward cash-to-float. */
  outOfPocket: boolean;
  /** Broker, shipper or insurance is expected to pay this back. */
  reimbursable: boolean;
  incurredAt: string;
};

// ---------------------------------------------------------------------------
// Fleet
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Company and drivers
// ---------------------------------------------------------------------------

/**
 * The carrier. In a company account this is the admin at the top — trucks and
 * drivers both hang off it. An owner-operator is just a company of one.
 */
export type Company = {
  name: string;
  /** USDOT number. The carrier's identity to FMCSA and to every broker. */
  dotNumber: string;
  /** MC/docket number. */
  mcNumber: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

/** CDL endorsements that change what a driver is allowed to haul. */
export type Endorsement = 'H' | 'N' | 'X' | 'T' | 'P' | 'S';

export const ENDORSEMENT_LABELS: Record<Endorsement, string> = {
  H: 'Hazmat',
  N: 'Tanker',
  X: 'Hazmat + Tanker',
  T: 'Doubles / Triples',
  P: 'Passenger',
  S: 'School bus',
};

export type DriverStatus = 'active' | 'inactive' | 'on-leave';

export type Driver = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;

  cdlNumber: string;
  cdlState: StateCode | '';
  cdlClass: 'A' | 'B' | 'C';
  /** ISO date. Driving on an expired CDL puts the carrier out of service. */
  cdlExpires: string;
  endorsements: Endorsement[];
  /** ISO date the DOT medical certificate expires. */
  medicalCardExpires: string;

  hireDate: string;
  status: DriverStatus;

  /**
   * Truck this driver is assigned to. Null means unassigned — on the bench.
   * Assignment lives here rather than on the truck so there is exactly one
   * place to change it, and so a team can put two drivers on one unit.
   */
  assignedTruckId: string | null;

  payMode: DriverPayMode;
  /** Cents per mile, or percent of linehaul, depending on `payMode`. */
  payRate: number;
  hosCycle: 60 | 70;
  notes: string;
};

/** A compliance item coming due or already expired. */
export type ComplianceAlert = {
  driverId: string;
  driverName: string;
  kind: 'cdl' | 'medical';
  expiresOn: string;
  daysRemaining: number;
  severity: 'expired' | 'critical' | 'warning';
  message: string;
};

export type Truck = {
  id: string;
  /** Unit number as painted on the door — how fleets actually refer to trucks. */
  unitNumber: string;
  nickname: string;
  year: number | null;
  make: string;
  model: string;
  vin: string;
  plate: string;
  active: boolean;
  /** This truck's own cost basis. Trucks in a fleet are rarely identical. */
  profile: TruckProfile;
  /** Planning utilization — revenue miles on a working day. */
  plannedMilesPerDay: number;
  /** Average all-in revenue per loaded mile this truck books. */
  targetRatePerMile: number;
  /** ISO date the truck entered service with this fleet. */
  inServiceSince: string;
};

export type Fleet = {
  company: Company;
  trucks: Truck[];
  drivers: Driver[];
};

export type LedgerKind = 'expense' | 'revenue';

/** A recorded, real-money event against a truck. */
export type LedgerEntry = {
  id: string;
  truckId: string;
  /** ISO-8601 date. */
  date: string;
  kind: LedgerKind;
  category: AddedCostCategory | 'linehaul' | 'fsc' | 'accessorial';
  label: string;
  amount: number;
  /** Miles associated with the entry, when it came from a completed trip. */
  miles: number;
  note: string;
};

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type CostBucket = {
  label: string;
  amount: number;
  /** Cost per mile contribution. */
  perMile: number;
  perDay: number;
  category: CostCategory;
};

export type TruckCostSummary = {
  truckId: string;
  /** "Unit 118 — Freightliner Cascadia" */
  title: string;
  subtitle: string;
  active: boolean;

  days: number;
  miles: number;

  fixedCost: number;
  fuelCost: number;
  variableCost: number;
  driverCost: number;
  /** Real recorded incidents — tows, tires, fines. Not modeled, actual. */
  incidentCost: number;
  totalCost: number;

  costPerMile: number;
  costPerDay: number;
  fixedCostPerDay: number;

  revenue: number;
  netProfit: number;
  profitPerMile: number;
  profitPerDay: number;
  /**
   * Operating ratio — operating cost divided by operating revenue, as a
   * percentage. The headline efficiency number in trucking. Under 95 is
   * healthy, under 90 is strong, over 100 means the truck is losing money.
   */
  operatingRatio: number;
  marginPercent: number;
  breakEvenRatePerMile: number;

  buckets: CostBucket[];
  /** Number of recorded incident entries in the window. */
  incidentCount: number;
  /** Drivers assigned to this unit. Two means a team. */
  driverNames: string[];
};

/** Cost and performance rolled up to the driver rather than the truck. */
export type DriverCostSummary = {
  driverId: string;
  name: string;
  status: DriverStatus;
  truckId: string | null;
  truckLabel: string;
  days: number;
  miles: number;
  totalCost: number;
  revenue: number;
  netProfit: number;
  costPerMile: number;
  revenuePerMile: number;
  operatingRatio: number;
  incidentCost: number;
  incidentCount: number;
};

export type FleetCostReport = {
  period: Period;
  /** ISO dates bounding the window. */
  from: string;
  to: string;
  days: number;
  /** Truck IDs the report was scoped to. */
  selectedTruckIds: string[];
  /** Total trucks in the fleet, for "3 of 12 trucks" framing. */
  fleetSize: number;
  perTruck: TruckCostSummary[];
  /** Same window, rolled up by driver instead of by unit. */
  perDriver: DriverCostSummary[];
  /** CDL and medical certificates expired or coming due. */
  complianceAlerts: ComplianceAlert[];
  combined: TruckCostSummary;
  /** Share of total fleet cost these selected trucks represent, 0–100. */
  shareOfFleetCost: number;
  fleetTotalCost: number;
  /** Ranked observations worth telling the owner about. */
  insights: string[];
};

// ---------------------------------------------------------------------------
// Truck / business profile — the cost basis
// ---------------------------------------------------------------------------

export type DriverPayMode = 'owner-operator' | 'per-mile' | 'percent-of-linehaul';

export type TruckProfile = {
  label: string;

  // --- Performance ---------------------------------------------------------
  /** Loaded average. Most modern class-8 sleepers run 6.0–7.5 loaded. */
  mpg: number;
  tankGallons: number;
  /** Planning speed including traffic, fuel stops and scales. 50–55 is honest. */
  avgSpeedMph: number;
  /** Reefer unit burn. ~0.4 gal/hr on start-stop, ~0.9 continuous. */
  reeferGalPerHour: number;
  /** Main engine or APU overnight burn. */
  idleGalPerHour: number;
  /** DEF consumed as a fraction of diesel burned. Typically 2–3%. */
  defFraction: number;
  defPricePerGal: number;

  // --- Fixed costs (monthly) ----------------------------------------------
  truckPaymentMo: number;
  trailerPaymentMo: number;
  /** Primary liability + cargo + physical damage + occ/accident. */
  insuranceMo: number;
  /** IRP plates, 2290 HVUT, UCR, IFTA, FMCSA — annualized to a month. */
  permitsLicensingMo: number;
  eldTelematicsMo: number;
  accountingLegalMo: number;
  /** Base/home terminal parking, tools, phone, misc overhead. */
  overheadMo: number;
  /** Revenue days per month. 22 is a realistic OTR month. */
  workingDaysPerMonth: number;

  // --- Variable costs (per mile) ------------------------------------------
  tiresCpm: number;
  maintenanceCpm: number;

  // --- Driver --------------------------------------------------------------
  driverPayMode: DriverPayMode;
  driverCpm: number;
  driverPercent: number;
  /** IRS per-diem for transportation workers, per full day away. */
  perDiemPerDay: number;

  // --- Money off the top ---------------------------------------------------
  factoringPercent: number;
  dispatchPercent: number;

  // --- Hours of service ----------------------------------------------------
  hosCycle: 60 | 70;
  /** Hours already used in the current 14-hour window at departure. */
  hoursAlreadyOnDuty: number;
};

// ---------------------------------------------------------------------------
// Service layer results
// ---------------------------------------------------------------------------

export type RouteSegment = {
  state: StateCode;
  miles: number;
  /** Midpoint of this segment, used to query weather. */
  midpoint: LatLng;
  /** Cumulative miles at the END of this segment. */
  cumulativeMiles: number;
};

export type Route = {
  totalMiles: number;
  /** Driving hours at planning speed, before breaks. */
  driveHours: number;
  segments: RouteSegment[];
  /** States crossed, in travel order, deduped. */
  states: StateCode[];
  tollEstimate: number;
  /** True when routing respected truck height/weight/hazmat limits. */
  truckLegal: boolean;
  provider: string;
};

export type FuelQuote = {
  region: PaddRegion;
  state: StateCode;
  pricePerGal: number;
  /** Miles driven in this state — used to weight the blended price. */
  miles: number;
};

export type FuelReport = {
  /** Mileage-weighted average diesel price across the route. */
  blendedPricePerGal: number;
  byState: FuelQuote[];
  nationalAvg: number;
  /** Cheapest state on the route — where to fill. */
  cheapestState: StateCode;
  cheapestPrice: number;
  asOf: string;
  provider: string;
};

export type WeatherSeverity = 'clear' | 'caution' | 'advisory' | 'severe';

export type WeatherPoint = {
  state: StateCode;
  atMile: number;
  /** ISO-8601 time the truck is projected to be here. */
  eta: string;
  tempF: number;
  windMph: number;
  gustMph: number;
  precip: 'none' | 'rain' | 'snow' | 'ice' | 'mixed';
  visibilityMi: number;
  severity: WeatherSeverity;
  summary: string;
  /** Active NWS alert headlines relevant to this point. */
  alerts: string[];
};

export type WeatherReport = {
  points: WeatherPoint[];
  worst: WeatherSeverity;
  provider: string;
};

export type IncidentKind = 'accident' | 'construction' | 'closure' | 'congestion' | 'weather-closure';

export type Incident = {
  kind: IncidentKind;
  state: StateCode;
  atMile: number;
  route: string;
  description: string;
  /** Projected minutes added to the trip. */
  delayMinutes: number;
  severity: 'low' | 'medium' | 'high';
};

export type TrafficReport = {
  incidents: Incident[];
  totalDelayMinutes: number;
  provider: string;
};

export type RestrictionKind =
  | 'hazmat-prohibited'
  | 'hazmat-permit'
  | 'tunnel'
  | 'bridge-clearance'
  | 'weight-limit'
  | 'chain-law'
  | 'oversize-permit'
  | 'idle-restriction'
  | 'port-of-entry';

export type Restriction = {
  kind: RestrictionKind;
  state: StateCode;
  title: string;
  detail: string;
  /** Cost this restriction imposes on the trip, if any. */
  costUsd: number;
  /** True when it can stop the load outright, not just cost money. */
  blocking: boolean;
};

export type RestrictionReport = {
  restrictions: Restriction[];
  provider: string;
};

// ---------------------------------------------------------------------------
// Calculated output
// ---------------------------------------------------------------------------

export type CostLine = {
  key: string;
  label: string;
  amount: number;
  /** Where the number came from, shown in the brief so nothing is a black box. */
  basis: string;
  category: CostCategory;
  /** Driver pays this before settlement, so it must be floated in cash. */
  outOfPocket: boolean;
  /** Reimbursable by broker/shipper on most contracts. */
  reimbursable: boolean;
};

export type CostCategory =
  | 'fuel'
  | 'variable'
  | 'fixed'
  | 'driver'
  | 'trip'
  | 'compliance'
  | 'business'
  | 'contingency'
  /** Real unplanned spend entered by the user — a tow, a tire, a citation. */
  | 'incident';

export type RevenueLine = {
  key: string;
  label: string;
  amount: number;
  basis: string;
  /** Money you may or may not collect (detention, layover). */
  contingent: boolean;
};

export type CostReport = {
  lines: CostLine[];
  revenue: RevenueLine[];
  totalCost: number;
  /** Revenue you can bank on. Excludes contingent accessorials. */
  committedRevenue: number;
  potentialRevenue: number;
  netProfit: number;
  profitPerMile: number;
  costPerMile: number;
  revenuePerMile: number;
  /** All-in rate/mile including deadhead — the number that actually matters. */
  allInRatePerMile: number;
  breakEvenRatePerMile: number;
  marginPercent: number;
  /** Cash out of pocket before settlement. */
  cashToFloat: number;
  profitPerDay: number;
};

export type HosStop = {
  kind: '30-min-break' | '10-hr-reset' | 'fuel' | 'delivery';
  atMile: number;
  /** ISO-8601 */
  at: string;
  durationHours: number;
  note: string;
};

export type HosPlan = {
  stops: HosStop[];
  /** Total elapsed hours including breaks and resets. */
  totalElapsedHours: number;
  drivingHours: number;
  /** ISO-8601 projected arrival. */
  eta: string;
  /** Days on the road, used for per-diem and fixed-cost allocation. */
  tripDays: number;
  nightsOut: number;
  /** False when the load cannot legally be delivered by the appointment. */
  legalOnTime: boolean;
  /** Hours of slack against the delivery appointment. Negative means late. */
  slackHours: number;
  /** Warnings about the 60/70-hour cycle. */
  cycleWarnings: string[];
};

export type RiskFactor = {
  label: string;
  detail: string;
  /** 0–100 contribution to the overall score. */
  weight: number;
  severity: 'low' | 'medium' | 'high';
};

export type RiskAssessment = {
  /** 0 = green, 100 = do not run. */
  score: number;
  level: 'GREEN' | 'AMBER' | 'RED';
  factors: RiskFactor[];
  /** Plain-language recommendation, convoy-brief style. */
  bottomLine: string;
};

export type TripBrief = {
  input: TripInput;
  addedCosts: AddedCost[];
  profile: TruckProfile;
  route: Route;
  fuel: FuelReport;
  weather: WeatherReport;
  traffic: TrafficReport;
  restrictions: RestrictionReport;
  hos: HosPlan;
  cost: CostReport;
  risk: RiskAssessment;
  generatedAt: string;
  /** True when any service returned mock rather than live data. */
  containsMockData: boolean;
  sources: { service: string; provider: string; live: boolean }[];
};
