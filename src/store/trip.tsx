import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cityById } from '../data/geo';
import { buildTripBrief } from '../services';
import type { AddedCost, TripBrief, TripInput, TruckProfile } from '../types';
import { newId } from './store';

/**
 * The trip being planned right now.
 *
 * Kept separate from the persisted fleet store because a draft is throwaway —
 * it lives for as long as the driver is filling out the form, and the brief it
 * produces is a snapshot, not a record. Anything worth keeping gets written to
 * the ledger explicitly.
 */

function defaultDeparture(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

export function emptyTrip(): TripInput {
  return {
    origin: cityById('dal')!,
    destination: cityById('chi')!,
    stops: [],
    deadheadMiles: 45,
    departAt: defaultDeparture(),
    equipment: 'dry-van',
    grossWeightLbs: 62000,
    rate: 2.6,
    rateMode: 'per-mile',
    hazmat: null,
    reeferSetPointF: null,
    oversize: false,
    lumperExpected: false,
    lumperEstimate: 250,
    deliverBy: null,
  };
}

export function makeAddedCost(partial: Partial<AddedCost> = {}): AddedCost {
  return {
    id: newId('cost'),
    label: 'Unplanned cost',
    amount: 0,
    category: 'other',
    note: '',
    outOfPocket: true,
    reimbursable: false,
    incurredAt: new Date().toISOString(),
    ...partial,
  };
}

type TripStore = {
  trip: TripInput;
  addedCosts: AddedCost[];
  brief: TripBrief | null;
  building: boolean;
  error: string | null;

  patchTrip: (patch: Partial<TripInput>) => void;
  resetTrip: () => void;
  addCost: (c: AddedCost) => void;
  removeCost: (id: string) => void;
  clearCosts: () => void;
  generate: (profile: TruckProfile) => Promise<TripBrief | null>;
};

const TripContext = createContext<TripStore | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trip, setTrip] = useState<TripInput>(emptyTrip);
  const [addedCosts, setAddedCosts] = useState<AddedCost[]>([]);
  const [brief, setBrief] = useState<TripBrief | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchTrip = useCallback((patch: Partial<TripInput>) => {
    setTrip((t) => ({ ...t, ...patch }));
  }, []);

  const resetTrip = useCallback(() => {
    setTrip(emptyTrip());
    setAddedCosts([]);
    setBrief(null);
    setError(null);
  }, []);

  const addCost = useCallback((c: AddedCost) => setAddedCosts((cs) => [...cs, c]), []);
  const removeCost = useCallback(
    (id: string) => setAddedCosts((cs) => cs.filter((c) => c.id !== id)),
    [],
  );
  const clearCosts = useCallback(() => setAddedCosts([]), []);

  const generate = useCallback(
    async (profile: TruckProfile) => {
      setBuilding(true);
      setError(null);
      try {
        const b = await buildTripBrief(trip, profile, addedCosts);
        setBrief(b);
        return b;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not build the brief.');
        return null;
      } finally {
        setBuilding(false);
      }
    },
    [trip, addedCosts],
  );

  const value = useMemo<TripStore>(
    () => ({
      trip,
      addedCosts,
      brief,
      building,
      error,
      patchTrip,
      resetTrip,
      addCost,
      removeCost,
      clearCosts,
      generate,
    }),
    [trip, addedCosts, brief, building, error, patchTrip, resetTrip, addCost, removeCost, clearCosts, generate],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripStore {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside <TripProvider>');
  return ctx;
}
