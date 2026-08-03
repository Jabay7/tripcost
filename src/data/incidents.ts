import type { AddedCostCategory } from '../types';

/**
 * Catalog of unplanned costs, with typical ranges.
 *
 * These are the events that wreck a month. Ranges reflect what owner-operators
 * and small fleets actually pay for roadside service in the lower 48 — service
 * call plus parts plus the shop's road rate, not a dealer counter price. They
 * exist so a driver entering a cost at 0200 on the shoulder of I-80 gets a
 * sensible default instead of a blank field.
 *
 * Frequency note used in the fleet insights: fleet-wide, an unscheduled
 * roadside event runs roughly one per 10,000–15,000 miles, and unscheduled
 * repair adds meaningfully on top of the scheduled maintenance CPM. A fleet
 * seeing materially worse than that has a maintenance program problem, not
 * bad luck.
 */
export type IncidentTemplate = {
  key: string;
  label: string;
  category: AddedCostCategory;
  typical: number;
  low: number;
  high: number;
  /** Usually recovered from a broker, shipper, warranty or insurer. */
  reimbursable: boolean;
  hint: string;
};

export const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  {
    key: 'tire-drive',
    label: 'Road service — drive tire',
    category: 'tire',
    typical: 600,
    low: 400,
    high: 900,
    reimbursable: false,
    hint: 'Service call plus a new drive tire. Recaps are cheaper; a blowout that takes fender or air lines with it is not.',
  },
  {
    key: 'tire-steer',
    label: 'Road service — steer tire',
    category: 'tire',
    typical: 750,
    low: 500,
    high: 1100,
    reimbursable: false,
    hint: 'Steers must be virgin rubber, so they cost more than drives.',
  },
  {
    key: 'tow-tractor',
    label: 'Heavy-duty tow',
    category: 'tow',
    typical: 1200,
    low: 500,
    high: 3000,
    reimbursable: false,
    hint: 'Hook fee plus per-mile. Recovery and winch-outs run far higher — get the rate before you agree.',
  },
  {
    key: 'roadcall-mechanic',
    label: 'Mobile mechanic road call',
    category: 'roadside',
    typical: 550,
    low: 250,
    high: 1200,
    reimbursable: false,
    hint: 'Typically a road-rate hourly charge with a two-hour minimum, plus parts.',
  },
  {
    key: 'battery-jump',
    label: 'Jump start / battery',
    category: 'roadside',
    typical: 300,
    low: 150,
    high: 700,
    reimbursable: false,
    hint: 'A set of four batteries is at the high end of this range.',
  },
  {
    key: 'airline',
    label: 'Air line / gladhand repair',
    category: 'roadside',
    typical: 220,
    low: 120,
    high: 400,
    reimbursable: false,
    hint: 'Common after a hard pull-out or a frozen line in winter.',
  },
  {
    key: 'dpf-regen',
    label: 'DPF / aftertreatment fault',
    category: 'breakdown',
    typical: 1400,
    low: 400,
    high: 4000,
    reimbursable: false,
    hint: 'A forced regen is cheap. A failed DPF or a doser is not.',
  },
  {
    key: 'alternator-starter',
    label: 'Alternator or starter',
    category: 'breakdown',
    typical: 1200,
    low: 800,
    high: 1900,
    reimbursable: false,
    hint: 'Roadside labor is the bulk of it.',
  },
  {
    key: 'reefer-repair',
    label: 'Reefer unit repair',
    category: 'breakdown',
    typical: 1300,
    low: 500,
    high: 2800,
    reimbursable: false,
    hint: 'A reefer failure often turns into a cargo claim too. Pull the download.',
  },
  {
    key: 'windshield',
    label: 'Windshield replacement',
    category: 'breakdown',
    typical: 600,
    low: 350,
    high: 1000,
    reimbursable: false,
    hint: 'A crack in the wiper path is an out-of-service item.',
  },
  {
    key: 'overweight-fine',
    label: 'Overweight citation',
    category: 'fine',
    typical: 700,
    low: 150,
    high: 2500,
    reimbursable: false,
    hint: 'Scales by the pound over. Some states also hold the truck until you redistribute or transfer.',
  },
  {
    key: 'hos-violation',
    label: 'Hours-of-service violation',
    category: 'fine',
    typical: 1200,
    low: 300,
    high: 3000,
    reimbursable: false,
    hint: 'Hits the driver and the carrier, and it follows the CSA score for two years.',
  },
  {
    key: 'moving-violation',
    label: 'Moving violation',
    category: 'fine',
    typical: 300,
    low: 100,
    high: 800,
    reimbursable: false,
    hint: 'A CMV citation raises insurance long after the fine is paid.',
  },
  {
    key: 'oos-repair',
    label: 'Out-of-service repair',
    category: 'breakdown',
    typical: 900,
    low: 200,
    high: 3000,
    reimbursable: false,
    hint: 'Roadside inspection put the truck OOS. Cost is the repair plus the load you lost.',
  },
  {
    key: 'lodging',
    label: 'Motel while down',
    category: 'lodging',
    typical: 120,
    low: 80,
    high: 220,
    reimbursable: false,
    hint: 'Add a rental car if the shop is not walkable.',
  },
  {
    key: 'lumper-extra',
    label: 'Unexpected lumper',
    category: 'labor',
    typical: 250,
    low: 100,
    high: 500,
    reimbursable: true,
    hint: 'Get the receipt. Most brokers reimburse but you front the cash.',
  },
  {
    key: 'detention-cost',
    label: 'Detention — unpaid time',
    category: 'labor',
    typical: 200,
    low: 50,
    high: 600,
    reimbursable: true,
    hint: 'Bill it. Note in and out times on the bill of lading before you leave.',
  },
  {
    key: 'cargo-claim',
    label: 'Cargo claim deductible',
    category: 'claim',
    typical: 1500,
    low: 500,
    high: 5000,
    reimbursable: false,
    hint: 'Your deductible on a damaged or rejected load.',
  },
  {
    key: 'permit-emergency',
    label: 'Emergency permit',
    category: 'permit',
    typical: 90,
    low: 25,
    high: 300,
    reimbursable: true,
    hint: 'Trip permit bought at a port of entry costs more than one bought ahead.',
  },
  {
    key: 'fuel-emergency',
    label: 'Emergency fuel / reefer fuel',
    category: 'fuel',
    typical: 250,
    low: 80,
    high: 600,
    reimbursable: false,
    hint: 'Off-network fuel at a truck stop you did not plan for.',
  },
  {
    key: 'other',
    label: 'Other',
    category: 'other',
    typical: 0,
    low: 0,
    high: 0,
    reimbursable: false,
    hint: 'Anything the list does not cover.',
  },
];

export const CATEGORY_LABELS: Record<AddedCostCategory, string> = {
  tow: 'Tow / recovery',
  tire: 'Tires',
  breakdown: 'Breakdown / repair',
  roadside: 'Roadside service',
  fine: 'Fines & citations',
  lodging: 'Lodging',
  permit: 'Permits',
  fuel: 'Fuel',
  labor: 'Labor / detention',
  claim: 'Claims',
  other: 'Other',
};

export const templateByKey = (key: string): IncidentTemplate | undefined =>
  INCIDENT_TEMPLATES.find((t) => t.key === key);
