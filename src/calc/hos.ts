import type { HosPlan, HosStop, Route, TripInput, TruckProfile } from '../types';

/**
 * Federal hours-of-service planner for property-carrying CMV drivers.
 *
 * Rules modeled (49 CFR 395.3):
 *   - 11-hour driving limit after 10 consecutive hours off duty
 *   - 14-hour on-duty window, which does not pause for breaks
 *   - 30-minute break required after 8 cumulative hours of driving
 *   - 60/7 or 70/8 cycle limit
 *
 * Not modeled: sleeper-berth splits (8/2 and 7/3), the 34-hour restart, the
 * short-haul and adverse-conditions exceptions. Those all buy the driver time,
 * so this plan is the conservative case — a driver who can legally split will
 * do better than what the brief shows, never worse.
 */

const MS_PER_HOUR = 3_600_000;

const DRIVE_LIMIT = 11;
const WINDOW_LIMIT = 14;
const BREAK_AFTER = 8;
const BREAK_LENGTH = 0.5;
const RESET_LENGTH = 10;

/** On-duty-not-driving time at a shipper or receiver. Two hours is typical. */
const DOCK_HOURS = 2;
/** Fuel stop cadence and duration. */
const MILES_PER_FUEL_STOP = 900;
const FUEL_STOP_HOURS = 0.75;

export function planHos(
  route: Route,
  input: TripInput,
  profile: TruckProfile,
  trafficDelayMinutes: number,
): HosPlan {
  const depart = new Date(input.departAt);
  const totalMiles = route.totalMiles;
  const speed = Math.max(30, profile.avgSpeedMph);

  // Traffic delay is time behind the wheel, so it burns drive hours too.
  const drivingHoursNeeded = totalMiles / speed + trafficDelayMinutes / 60;

  // Delay hours cover no ground, so distance cannot be derived from hours times
  // speed — that overshoots and puts stop markers past the destination. Map
  // between the two proportionally instead, which keeps every mile marker
  // inside the route while still spending the delay on the clock.
  const milesAt = (h: number) => (h / drivingHoursNeeded) * totalMiles;
  const hoursAt = (m: number) => (m / totalMiles) * drivingHoursNeeded;

  const fuelStops = Math.max(0, Math.floor(totalMiles / MILES_PER_FUEL_STOP));
  const stops: HosStop[] = [];

  let clock = depart.getTime();
  let milesDone = 0;
  let hoursDriven = 0;
  let driveSinceBreak = 0;
  let driveInWindow = 0;
  let windowUsed = Math.max(0, profile.hoursAlreadyOnDuty);
  let nightsOut = 0;
  let totalOnDuty = 0;
  let nextFuelAt = MILES_PER_FUEL_STOP;
  let guard = 0;

  const at = () => new Date(clock).toISOString();

  // Loading at the shipper burns the 14-hour window before a mile is driven.
  windowUsed += DOCK_HOURS;
  totalOnDuty += DOCK_HOURS;
  clock += DOCK_HOURS * MS_PER_HOUR;
  stops.push({
    kind: 'delivery',
    atMile: 0,
    at: at(),
    durationHours: DOCK_HOURS,
    note: 'Loading at shipper — on duty, not driving. Burns the 14-hour window.',
  });

  while (hoursDriven < drivingHoursNeeded - 0.01 && guard++ < 500) {
    const windowLeft = WINDOW_LIMIT - windowUsed;
    const dailyLeft = DRIVE_LIMIT - driveInWindow;
    const breakLeft = BREAK_AFTER - driveSinceBreak;
    const tripLeft = drivingHoursNeeded - hoursDriven;

    if (breakLeft <= 0.01 && windowLeft > 0.01 && dailyLeft > 0.01) {
      clock += BREAK_LENGTH * MS_PER_HOUR;
      windowUsed += BREAK_LENGTH;
      driveSinceBreak = 0;
      stops.push({
        kind: '30-min-break',
        atMile: Math.round(milesDone),
        at: at(),
        durationHours: BREAK_LENGTH,
        note: 'Required 30-minute break after 8 cumulative hours of driving.',
      });
      continue;
    }

    if (windowLeft <= 0.01 || dailyLeft <= 0.01) {
      clock += RESET_LENGTH * MS_PER_HOUR;
      windowUsed = 0;
      driveInWindow = 0;
      driveSinceBreak = 0;
      nightsOut += 1;
      stops.push({
        kind: '10-hr-reset',
        atMile: Math.round(milesDone),
        at: at(),
        durationHours: RESET_LENGTH,
        note: '10-hour off-duty reset. Find parking early — lots fill by 1600.',
      });
      continue;
    }

    const chunk = Math.min(windowLeft, dailyLeft, breakLeft, tripLeft);
    const chunkMiles = milesAt(hoursDriven + chunk) - milesDone;

    // Slot a fuel stop in if we cross the threshold during this stretch.
    if (fuelStops > 0 && milesDone + chunkMiles >= nextFuelAt && nextFuelAt < totalMiles) {
      const toFuel = Math.max(0, hoursAt(nextFuelAt) - hoursDriven);
      clock += toFuel * MS_PER_HOUR;
      hoursDriven += toFuel;
      driveSinceBreak += toFuel;
      driveInWindow += toFuel;
      windowUsed += toFuel;
      totalOnDuty += toFuel;
      milesDone = nextFuelAt;

      clock += FUEL_STOP_HOURS * MS_PER_HOUR;
      windowUsed += FUEL_STOP_HOURS;
      totalOnDuty += FUEL_STOP_HOURS;
      stops.push({
        kind: 'fuel',
        atMile: Math.round(milesDone),
        at: at(),
        durationHours: FUEL_STOP_HOURS,
        note: 'Planned fuel stop. Pre-trip the tires and lights while the tank fills.',
      });
      nextFuelAt += MILES_PER_FUEL_STOP;
      continue;
    }

    clock += chunk * MS_PER_HOUR;
    hoursDriven += chunk;
    driveSinceBreak += chunk;
    driveInWindow += chunk;
    windowUsed += chunk;
    totalOnDuty += chunk;
    milesDone = Math.min(totalMiles, milesAt(hoursDriven));
  }

  // Unloading at the receiver.
  clock += DOCK_HOURS * MS_PER_HOUR;
  totalOnDuty += DOCK_HOURS;
  stops.push({
    kind: 'delivery',
    atMile: Math.round(totalMiles),
    at: at(),
    durationHours: DOCK_HOURS,
    note: 'Unloading at receiver. Detention clock starts after the free window.',
  });

  const eta = new Date(clock);
  const totalElapsedHours = (clock - depart.getTime()) / MS_PER_HOUR;

  const cycleWarnings: string[] = [];
  const cycleLimit = profile.hosCycle;
  if (totalOnDuty > cycleLimit) {
    cycleWarnings.push(
      `This trip needs ${totalOnDuty.toFixed(1)} on-duty hours, more than the entire ${cycleLimit}-hour cycle. ` +
        'A 34-hour restart is required mid-trip, or the load needs a team.',
    );
  } else if (totalOnDuty > cycleLimit * 0.75) {
    cycleWarnings.push(
      `This trip consumes ${totalOnDuty.toFixed(1)} of ${cycleLimit} cycle hours. ` +
        'Check your recap before accepting — you may not have hours left for the next load.',
    );
  }
  if (profile.hoursAlreadyOnDuty > 0) {
    cycleWarnings.push(
      `Departing with ${profile.hoursAlreadyOnDuty.toFixed(1)} hours already used in the 14-hour window.`,
    );
  }

  let legalOnTime = true;
  let slackHours = Number.POSITIVE_INFINITY;
  if (input.deliverBy) {
    const due = new Date(input.deliverBy).getTime();
    slackHours = (due - clock) / MS_PER_HOUR;
    legalOnTime = slackHours >= 0;
  }

  return {
    stops,
    totalElapsedHours,
    drivingHours: hoursDriven,
    eta: eta.toISOString(),
    tripDays: nightsOut + 1,
    nightsOut,
    legalOnTime,
    slackHours,
    cycleWarnings,
  };
}
