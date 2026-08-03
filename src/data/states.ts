import type { PaddRegion, StateCode } from '../types';

export type StateInfo = {
  name: string;
  padd: PaddRegion;
  /** State diesel excise + applicable sales/environmental fees, cents per gallon. */
  dieselTaxCpg: number;
  /** Months (1-12) when a chain law can be enforced. Empty = never. */
  chainLawMonths: number[];
  /** Notable statewide notes a driver should hear in a brief. */
  notes: string[];
};

/**
 * State reference data.
 *
 * Diesel tax figures are the combined state-imposed cents-per-gallon burden
 * used to spread the regional EIA price across a route. They move a few cents
 * a year; the shape matters more than the third decimal.
 */
export const STATES: Record<StateCode, StateInfo> = {
  AL: { name: 'Alabama', padd: 'LOWER_ATLANTIC', dieselTaxCpg: 30.2, chainLawMonths: [], notes: [] },
  AK: { name: 'Alaska', padd: 'WEST_COAST', dieselTaxCpg: 9.0, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['Studded tire and chain seasons vary by borough.'] },
  AZ: { name: 'Arizona', padd: 'WEST_COAST', dieselTaxCpg: 27.0, chainLawMonths: [12, 1, 2], notes: ['I-17 and I-40 north of Flagstaff close for snow.'] },
  AR: { name: 'Arkansas', padd: 'GULF_COAST', dieselTaxCpg: 28.5, chainLawMonths: [], notes: [] },
  CA: { name: 'California', padd: 'CALIFORNIA', dieselTaxCpg: 96.5, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['CARB-compliant engine and trailer required.', 'R1/R2/R3 chain controls on all mountain passes.', 'Statewide 5-minute idle limit.'] },
  CO: { name: 'Colorado', padd: 'ROCKY_MOUNTAIN', dieselTaxCpg: 22.0, chainLawMonths: [9, 10, 11, 12, 1, 2, 3, 4, 5], notes: ['I-70 traction law Sept 1 – May 31, $500+ fines.', 'Eisenhower Tunnel bans hazmat — use Loveland Pass US-6.'] },
  CT: { name: 'Connecticut', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 49.2, chainLawMonths: [], notes: ['Highway Use Fee applies to heavy trucks.', 'Parkways are car-only, low clearances.'] },
  DE: { name: 'Delaware', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 22.0, chainLawMonths: [], notes: [] },
  DC: { name: 'District of Columbia', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 28.8, chainLawMonths: [], notes: ['Through-truck restrictions on most non-interstate routes.'] },
  FL: { name: 'Florida', padd: 'LOWER_ATLANTIC', dieselTaxCpg: 37.0, chainLawMonths: [], notes: ['Hurricane season Jun–Nov can close I-10 and I-75.'] },
  GA: { name: 'Georgia', padd: 'LOWER_ATLANTIC', dieselTaxCpg: 35.5, chainLawMonths: [], notes: [] },
  HI: { name: 'Hawaii', padd: 'WEST_COAST', dieselTaxCpg: 17.0, chainLawMonths: [], notes: [] },
  ID: { name: 'Idaho', padd: 'ROCKY_MOUNTAIN', dieselTaxCpg: 32.0, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['Lookout Pass and Fourth of July Pass chain up frequently.'] },
  IL: { name: 'Illinois', padd: 'MIDWEST', dieselTaxCpg: 69.6, chainLawMonths: [], notes: ['Chicago-area tolls are heavy; I-80/I-294 congestion.'] },
  IN: { name: 'Indiana', padd: 'MIDWEST', dieselTaxCpg: 59.0, chainLawMonths: [], notes: ['Indiana Toll Road I-80/90 is a major toll segment.'] },
  IA: { name: 'Iowa', padd: 'MIDWEST', dieselTaxCpg: 32.5, chainLawMonths: [11, 12, 1, 2, 3], notes: ['I-80 ground blizzards and travel bans in winter.'] },
  KS: { name: 'Kansas', padd: 'MIDWEST', dieselTaxCpg: 26.0, chainLawMonths: [12, 1, 2], notes: ['Kansas Turnpike I-35/I-70 toll.'] },
  KY: { name: 'Kentucky', padd: 'MIDWEST', dieselTaxCpg: 26.9, chainLawMonths: [], notes: [] },
  LA: { name: 'Louisiana', padd: 'GULF_COAST', dieselTaxCpg: 20.0, chainLawMonths: [], notes: ['Atchafalaya Basin bridge — no shoulder, frequent backups.'] },
  ME: { name: 'Maine', padd: 'NEW_ENGLAND', dieselTaxCpg: 31.2, chainLawMonths: [11, 12, 1, 2, 3], notes: [] },
  MD: { name: 'Maryland', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 45.8, chainLawMonths: [], notes: ['Baltimore Harbor and Fort McHenry tunnels ban hazmat — use I-695 west.'] },
  MA: { name: 'Massachusetts', padd: 'NEW_ENGLAND', dieselTaxCpg: 24.0, chainLawMonths: [12, 1, 2], notes: ['Boston tunnels ban hazmat.', 'Storrow Drive and parkways have infamous low clearances.'] },
  MI: { name: 'Michigan', padd: 'MIDWEST', dieselTaxCpg: 50.2, chainLawMonths: [11, 12, 1, 2, 3], notes: ['Frost laws restrict weights in spring thaw.'] },
  MN: { name: 'Minnesota', padd: 'MIDWEST', dieselTaxCpg: 31.4, chainLawMonths: [11, 12, 1, 2, 3], notes: ['Spring frost laws cut allowable axle weights.'] },
  MS: { name: 'Mississippi', padd: 'GULF_COAST', dieselTaxCpg: 18.4, chainLawMonths: [], notes: [] },
  MO: { name: 'Missouri', padd: 'MIDWEST', dieselTaxCpg: 27.0, chainLawMonths: [12, 1, 2], notes: [] },
  MT: { name: 'Montana', padd: 'ROCKY_MOUNTAIN', dieselTaxCpg: 29.8, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['Long stretches with no services — plan fuel carefully.'] },
  NE: { name: 'Nebraska', padd: 'MIDWEST', dieselTaxCpg: 29.5, chainLawMonths: [11, 12, 1, 2, 3], notes: ['I-80 closes for blizzards with little warning.'] },
  NV: { name: 'Nevada', padd: 'WEST_COAST', dieselTaxCpg: 28.6, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['I-80 Donner Pass area chain controls.'] },
  NH: { name: 'New Hampshire', padd: 'NEW_ENGLAND', dieselTaxCpg: 23.8, chainLawMonths: [11, 12, 1, 2, 3], notes: [] },
  NJ: { name: 'New Jersey', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 49.3, chainLawMonths: [], notes: ['NJ Turnpike tolls are significant.', 'Hazmat banned in Hudson River tunnels.'] },
  NM: { name: 'New Mexico', padd: 'ROCKY_MOUNTAIN', dieselTaxCpg: 22.9, chainLawMonths: [12, 1, 2], notes: ['Weight-distance tax permit required.', 'Raton Pass I-25 chain controls.'] },
  NY: { name: 'New York', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 47.4, chainLawMonths: [11, 12, 1, 2, 3], notes: ['HUT permit required.', 'NYC bridge/tunnel hazmat bans; parkways are car-only.'] },
  NC: { name: 'North Carolina', padd: 'LOWER_ATLANTIC', dieselTaxCpg: 40.4, chainLawMonths: [12, 1, 2], notes: [] },
  ND: { name: 'North Dakota', padd: 'MIDWEST', dieselTaxCpg: 23.0, chainLawMonths: [11, 12, 1, 2, 3], notes: ['Statewide travel bans during blizzards.'] },
  OH: { name: 'Ohio', padd: 'MIDWEST', dieselTaxCpg: 47.0, chainLawMonths: [12, 1, 2], notes: ['Ohio Turnpike toll on I-80/90.'] },
  OK: { name: 'Oklahoma', padd: 'GULF_COAST', dieselTaxCpg: 20.0, chainLawMonths: [12, 1, 2], notes: ['Turnpike network tolls.'] },
  OR: { name: 'Oregon', padd: 'WEST_COAST', dieselTaxCpg: 40.0, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['Weight-mile tax — diesel sold tax-differently; permit required.', 'Siskiyou Pass I-5 chain controls.'] },
  PA: { name: 'Pennsylvania', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 78.5, chainLawMonths: [11, 12, 1, 2, 3], notes: ['Highest diesel tax in the country — fuel elsewhere.', 'PA Turnpike tolls are among the highest.', 'Hazmat restricted in Pittsburgh tunnels.'] },
  RI: { name: 'Rhode Island', padd: 'NEW_ENGLAND', dieselTaxCpg: 37.0, chainLawMonths: [12, 1, 2], notes: [] },
  SC: { name: 'South Carolina', padd: 'LOWER_ATLANTIC', dieselTaxCpg: 28.8, chainLawMonths: [], notes: [] },
  SD: { name: 'South Dakota', padd: 'MIDWEST', dieselTaxCpg: 28.0, chainLawMonths: [11, 12, 1, 2, 3], notes: ['I-90 closes for blizzards.'] },
  TN: { name: 'Tennessee', padd: 'MIDWEST', dieselTaxCpg: 27.0, chainLawMonths: [12, 1, 2], notes: ['Monteagle grade on I-24 — runaway ramps, heavy enforcement.'] },
  TX: { name: 'Texas', padd: 'GULF_COAST', dieselTaxCpg: 20.0, chainLawMonths: [], notes: ['Cheapest large-state diesel — top off before leaving.'] },
  UT: { name: 'Utah', padd: 'ROCKY_MOUNTAIN', dieselTaxCpg: 36.5, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['Parleys Canyon I-80 grade and chain controls.'] },
  VT: { name: 'Vermont', padd: 'NEW_ENGLAND', dieselTaxCpg: 34.0, chainLawMonths: [11, 12, 1, 2, 3], notes: [] },
  VA: { name: 'Virginia', padd: 'LOWER_ATLANTIC', dieselTaxCpg: 40.6, chainLawMonths: [12, 1, 2], notes: ['Hampton Roads and Monitor-Merrimac tunnels ban hazmat.', 'I-81 heavy truck traffic and enforcement.'] },
  WA: { name: 'Washington', padd: 'WEST_COAST', dieselTaxCpg: 49.4, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['Snoqualmie Pass I-90 chain controls and closures.'] },
  WV: { name: 'West Virginia', padd: 'CENTRAL_ATLANTIC', dieselTaxCpg: 37.1, chainLawMonths: [11, 12, 1, 2, 3], notes: ['WV Turnpike toll on I-77.', 'Steep sustained grades on I-77 and I-64.'] },
  WI: { name: 'Wisconsin', padd: 'MIDWEST', dieselTaxCpg: 32.9, chainLawMonths: [11, 12, 1, 2, 3], notes: [] },
  WY: { name: 'Wyoming', padd: 'ROCKY_MOUNTAIN', dieselTaxCpg: 24.0, chainLawMonths: [10, 11, 12, 1, 2, 3, 4], notes: ['I-80 is the most closure-prone interstate in the country.', 'Light/empty trailer wind restrictions are common.'] },
};

/** Median diesel tax, used as the zero point when spreading regional prices. */
export const MEDIAN_DIESEL_TAX_CPG = 31.5;

export const stateName = (s: StateCode): string => STATES[s]?.name ?? s;

export const isChainLawSeason = (s: StateCode, date: Date): boolean =>
  STATES[s]?.chainLawMonths.includes(date.getMonth() + 1) ?? false;
