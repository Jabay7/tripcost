import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROFILE } from '../data/defaults';
import type { Company, Driver, Fleet, LedgerEntry, Truck, TruckProfile } from '../types';

const STORAGE_KEY = 'tripcost.state.v2';

export type PersistedState = {
  fleet: Fleet;
  ledger: LedgerEntry[];
  activeTruckId: string | null;
};

export function newId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeTruck(unitNumber: string, overrides: Partial<Truck> = {}): Truck {
  return {
    id: newId('truck'),
    unitNumber,
    nickname: '',
    year: null,
    make: '',
    model: '',
    vin: '',
    plate: '',
    active: true,
    profile: { ...DEFAULT_PROFILE, label: `Unit ${unitNumber}` },
    plannedMilesPerDay: 500,
    targetRatePerMile: 2.6,
    inServiceSince: new Date().toISOString(),
    ...overrides,
  };
}

/** ISO date `months` from now, used for seeding credential expiry dates. */
function monthsOut(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: newId('drv'),
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    cdlNumber: '',
    cdlState: '',
    cdlClass: 'A',
    cdlExpires: monthsOut(36),
    endorsements: [],
    medicalCardExpires: monthsOut(24),
    hireDate: new Date().toISOString(),
    status: 'active',
    assignedTruckId: null,
    payMode: 'per-mile',
    payRate: 0.65,
    hosCycle: 70,
    notes: '',
    ...overrides,
  };
}

export const DEFAULT_COMPANY: Company = {
  name: 'My Carrier',
  dotNumber: '',
  mcNumber: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
};

/**
 * Seed fleet so a first-run user sees a working report instead of an empty
 * screen. Three trucks with deliberately different cost bases, because the
 * whole point of the fleet view is comparing them.
 */
function seedState(): PersistedState {
  const t1 = makeTruck('118', {
    nickname: 'Blue',
    year: 2021,
    make: 'Freightliner',
    model: 'Cascadia',
    plannedMilesPerDay: 520,
    targetRatePerMile: 2.65,
  });
  const t2 = makeTruck('204', {
    year: 2019,
    make: 'Peterbilt',
    model: '579',
    plannedMilesPerDay: 470,
    targetRatePerMile: 2.55,
    profile: {
      ...DEFAULT_PROFILE,
      label: 'Unit 204',
      mpg: 6.1,
      truckPaymentMo: 1750,
      maintenanceCpm: 0.26, // Older truck, higher upkeep.
    },
  });
  const t3 = makeTruck('307', {
    year: 2023,
    make: 'Kenworth',
    model: 'T680',
    plannedMilesPerDay: 540,
    targetRatePerMile: 2.72,
    profile: {
      ...DEFAULT_PROFILE,
      label: 'Unit 307',
      mpg: 7.1,
      truckPaymentMo: 2650,
      maintenanceCpm: 0.14, // Newer, still under warranty.
    },
  });

  const now = Date.now();
  const day = 86_400_000;
  const ledger: LedgerEntry[] = [
    {
      id: newId('led'),
      truckId: t2.id,
      date: new Date(now - 6 * day).toISOString(),
      kind: 'expense',
      category: 'tire',
      label: 'Road service — drive tire',
      amount: 640,
      miles: 0,
      note: 'Blowout on I-80 near Grand Island.',
    },
    {
      id: newId('led'),
      truckId: t2.id,
      date: new Date(now - 3 * day).toISOString(),
      kind: 'expense',
      category: 'tow',
      label: 'Heavy-duty tow',
      amount: 1150,
      miles: 0,
      note: 'Air system failure, towed 22 mi to shop.',
    },
    {
      id: newId('led'),
      truckId: t1.id,
      date: new Date(now - 11 * day).toISOString(),
      kind: 'expense',
      category: 'fine',
      label: 'Overweight citation',
      amount: 380,
      miles: 0,
      note: 'Tandems not slid before the scale.',
    },
  ];

  // One credential deliberately seeded close to expiry so the compliance panel
  // has something to show on first run.
  const drivers: Driver[] = [
    makeDriver({
      firstName: 'Javier',
      lastName: 'Alvarez',
      phone: '(214) 555-0142',
      cdlNumber: 'TX4417892',
      cdlState: 'TX',
      cdlClass: 'A',
      endorsements: ['H', 'N'],
      assignedTruckId: t1.id,
      cdlExpires: monthsOut(20),
      medicalCardExpires: monthsOut(1),
      payMode: 'per-mile',
      payRate: 0.68,
    }),
    makeDriver({
      firstName: 'Rachel',
      lastName: 'Okafor',
      phone: '(312) 555-0177',
      cdlNumber: 'IL8823014',
      cdlState: 'IL',
      cdlClass: 'A',
      endorsements: ['T'],
      assignedTruckId: t2.id,
      cdlExpires: monthsOut(30),
      medicalCardExpires: monthsOut(14),
      payMode: 'per-mile',
      payRate: 0.62,
    }),
    makeDriver({
      firstName: 'Darius',
      lastName: 'Whitfield',
      phone: '(901) 555-0119',
      cdlNumber: 'TN2290551',
      cdlState: 'TN',
      cdlClass: 'A',
      endorsements: ['H', 'N', 'X'],
      assignedTruckId: t3.id,
      cdlExpires: monthsOut(44),
      medicalCardExpires: monthsOut(9),
      payMode: 'percent-of-linehaul',
      payRate: 27,
    }),
  ];

  return {
    fleet: {
      company: { ...DEFAULT_COMPANY, name: 'My Carrier' },
      trucks: [t1, t2, t3],
      drivers,
    },
    ledger,
    activeTruckId: t1.id,
  };
}

type Store = PersistedState & {
  ready: boolean;
  addTruck: (t: Truck) => void;
  updateTruck: (id: string, patch: Partial<Truck>) => void;
  updateTruckProfile: (id: string, patch: Partial<TruckProfile>) => void;
  removeTruck: (id: string) => void;
  setActiveTruck: (id: string) => void;
  addDriver: (d: Driver) => void;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  removeDriver: (id: string) => void;
  /** Seats a driver in a unit, or benches them when `truckId` is null. */
  assignDriver: (driverId: string, truckId: string | null) => void;
  updateCompany: (patch: Partial<Company>) => void;
  addLedgerEntry: (e: LedgerEntry) => void;
  removeLedgerEntry: (id: string) => void;
  resetToSeed: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => seedState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as PersistedState;
          // Guard against a partially-written or older payload.
          if (parsed?.fleet?.trucks?.length) setState(parsed);
        }
      } catch {
        // A corrupt payload should not brick the app; the seed state stands.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const addTruck = useCallback((t: Truck) => {
    setState((s) => ({ ...s, fleet: { ...s.fleet, trucks: [...s.fleet.trucks, t] } }));
  }, []);

  const updateTruck = useCallback((id: string, patch: Partial<Truck>) => {
    setState((s) => ({
      ...s,
      fleet: {
        ...s.fleet,
        trucks: s.fleet.trucks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    }));
  }, []);

  const updateTruckProfile = useCallback((id: string, patch: Partial<TruckProfile>) => {
    setState((s) => ({
      ...s,
      fleet: {
        ...s.fleet,
        trucks: s.fleet.trucks.map((t) =>
          t.id === id ? { ...t, profile: { ...t.profile, ...patch } } : t,
        ),
      },
    }));
  }, []);

  const removeTruck = useCallback((id: string) => {
    setState((s) => {
      const trucks = s.fleet.trucks.filter((t) => t.id !== id);
      return {
        ...s,
        fleet: {
          ...s.fleet,
          trucks,
          // Bench anyone who was seated in the removed unit rather than leaving
          // them pointed at a truck that no longer exists.
          drivers: s.fleet.drivers.map((d) =>
            d.assignedTruckId === id ? { ...d, assignedTruckId: null } : d,
          ),
        },
        ledger: s.ledger.filter((e) => e.truckId !== id),
        activeTruckId: s.activeTruckId === id ? (trucks[0]?.id ?? null) : s.activeTruckId,
      };
    });
  }, []);

  const addDriver = useCallback((d: Driver) => {
    setState((s) => ({ ...s, fleet: { ...s.fleet, drivers: [...s.fleet.drivers, d] } }));
  }, []);

  const updateDriver = useCallback((id: string, patch: Partial<Driver>) => {
    setState((s) => ({
      ...s,
      fleet: {
        ...s.fleet,
        drivers: s.fleet.drivers.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      },
    }));
  }, []);

  const removeDriver = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      fleet: { ...s.fleet, drivers: s.fleet.drivers.filter((d) => d.id !== id) },
    }));
  }, []);

  const assignDriver = useCallback((driverId: string, truckId: string | null) => {
    setState((s) => ({
      ...s,
      fleet: {
        ...s.fleet,
        drivers: s.fleet.drivers.map((d) =>
          d.id === driverId ? { ...d, assignedTruckId: truckId } : d,
        ),
      },
    }));
  }, []);

  const updateCompany = useCallback((patch: Partial<Company>) => {
    setState((s) => ({ ...s, fleet: { ...s.fleet, company: { ...s.fleet.company, ...patch } } }));
  }, []);

  const setActiveTruck = useCallback((id: string) => {
    setState((s) => ({ ...s, activeTruckId: id }));
  }, []);

  const addLedgerEntry = useCallback((e: LedgerEntry) => {
    setState((s) => ({ ...s, ledger: [e, ...s.ledger] }));
  }, []);

  const removeLedgerEntry = useCallback((id: string) => {
    setState((s) => ({ ...s, ledger: s.ledger.filter((e) => e.id !== id) }));
  }, []);

  const resetToSeed = useCallback(() => setState(seedState()), []);

  const value = useMemo<Store>(
    () => ({
      ...state,
      ready,
      addTruck,
      updateTruck,
      updateTruckProfile,
      removeTruck,
      setActiveTruck,
      addDriver,
      updateDriver,
      removeDriver,
      assignDriver,
      updateCompany,
      addLedgerEntry,
      removeLedgerEntry,
      resetToSeed,
    }),
    [
      state,
      ready,
      addTruck,
      updateTruck,
      updateTruckProfile,
      removeTruck,
      setActiveTruck,
      addDriver,
      updateDriver,
      removeDriver,
      assignDriver,
      updateCompany,
      addLedgerEntry,
      removeLedgerEntry,
      resetToSeed,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** The truck currently selected for trip planning. Falls back to the first. */
export function useActiveTruck(): Truck | null {
  const { fleet, activeTruckId } = useStore();
  return fleet.trucks.find((t) => t.id === activeTruckId) ?? fleet.trucks[0] ?? null;
}

/** Drivers seated in a given unit. Two means a team. */
export function useDriversForTruck(truckId: string | null | undefined): Driver[] {
  const { fleet } = useStore();
  if (!truckId) return [];
  return fleet.drivers.filter((d) => d.assignedTruckId === truckId);
}
