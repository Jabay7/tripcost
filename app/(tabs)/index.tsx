import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_LABELS } from '../../src/data/incidents';
import { useActiveTruck, useStore } from '../../src/store/store';
import { useTrip } from '../../src/store/trip';
import type { EquipmentType, HazmatClass } from '../../src/types';
import {
  Body,
  Button,
  Card,
  Dim,
  Empty,
  Field,
  Screen,
  Section,
  Segmented,
  Toggle,
} from '../../src/ui/components';
import { DateTimeField } from '../../src/ui/DateTimeField';
import { PlacePicker } from '../../src/ui/PlacePicker';
import { colors, radius, space, type, usd } from '../../src/ui/theme';

const EQUIPMENT: { value: EquipmentType; label: string }[] = [
  { value: 'dry-van', label: 'Dry Van' },
  { value: 'reefer', label: 'Reefer' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'tanker', label: 'Tanker' },
];

const HAZMAT: { value: HazmatClass | 'none'; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: '3-flammable-liquid', label: 'Cl 3 Flam' },
  { value: '8-corrosive', label: 'Cl 8 Corr' },
  { value: '2-gases', label: 'Cl 2 Gas' },
];

export default function PlanTripScreen() {
  const { fleet, activeTruckId, setActiveTruck } = useStore();
  const truck = useActiveTruck();
  const { trip, patchTrip, addedCosts, removeCost, generate, building, error } = useTrip();

  const addedTotal = useMemo(() => addedCosts.reduce((s, c) => s + c.amount, 0), [addedCosts]);

  if (!truck) {
    return (
      <Screen>
        <Empty
          title="No trucks yet"
          body="Add a truck on the Trucks tab before planning a trip — the cost basis comes from the truck."
        />
        <Button title="Go to Trucks" onPress={() => router.push('/(tabs)/trucks')} />
      </Screen>
    );
  }

  const onGenerate = async () => {
    const b = await generate(truck.profile);
    if (b) router.push('/brief');
  };

  return (
    <Screen>
      {/* --- Truck ---------------------------------------------------------- */}
      <Section title="Truck" subtitle="Cost basis comes from this unit">
        <View style={s.truckRow}>
          {fleet.trucks.map((t) => {
            const active = t.id === (activeTruckId ?? fleet.trucks[0]?.id);
            return (
              <Pressable
                key={t.id}
                onPress={() => setActiveTruck(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[s.truckChip, active && s.truckChipOn]}
              >
                <Text style={[s.truckChipUnit, active && { color: colors.text }]}>
                  {t.unitNumber}
                </Text>
                <Text style={s.truckChipSub} numberOfLines={1}>
                  {t.profile.mpg} mpg
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* --- Route ---------------------------------------------------------- */}
      <Section title="Route">
        <View style={{ gap: space.sm }}>
          <PlacePicker
            label="Origin"
            value={trip.origin}
            onChange={(p) => patchTrip({ origin: p })}
            accent={colors.green}
          />
          <PlacePicker
            label="Destination"
            value={trip.destination}
            onChange={(p) => patchTrip({ destination: p })}
            accent={colors.red}
          />
          <Field
            label="Deadhead to shipper"
            value={String(trip.deadheadMiles)}
            onChangeText={(v) => patchTrip({ deadheadMiles: num(v) })}
            keyboardType="numeric"
            suffix="mi"
            hint="Empty miles cost you fuel and wear but earn nothing. They belong in the math."
          />
        </View>
      </Section>

      {/* --- Schedule ------------------------------------------------------- */}
      <Section title="Schedule">
        <Card>
          <DateTimeField
            label="Depart"
            value={trip.departAt}
            onChange={(iso) => patchTrip({ departAt: iso })}
          />
          <View style={s.hr} />
          <Toggle
            label="Hard delivery appointment"
            value={trip.deliverBy !== null}
            onChange={(on) =>
              patchTrip({
                deliverBy: on
                  ? new Date(new Date(trip.departAt).getTime() + 48 * 3_600_000).toISOString()
                  : null,
              })
            }
            hint="Turn on to check whether the load can be delivered legally on time."
          />
          {trip.deliverBy !== null ? (
            <DateTimeField
              label="Deliver by"
              value={trip.deliverBy}
              onChange={(iso) => patchTrip({ deliverBy: iso })}
            />
          ) : null}
        </Card>
      </Section>

      {/* --- Load ----------------------------------------------------------- */}
      <Section title="Load">
        <Card>
          <Text style={s.fieldLabel}>EQUIPMENT</Text>
          <Segmented
            options={EQUIPMENT}
            value={trip.equipment}
            onChange={(v) =>
              patchTrip({
                equipment: v,
                reeferSetPointF: v === 'reefer' ? (trip.reeferSetPointF ?? 34) : null,
              })
            }
            small
          />

          {trip.equipment === 'reefer' ? (
            <Field
              label="Reefer set point"
              value={String(trip.reeferSetPointF ?? 34)}
              onChangeText={(v) => patchTrip({ reeferSetPointF: num(v) })}
              keyboardType="numeric"
              suffix="°F"
              hint="The unit burns fuel the entire trip, including while you sleep."
            />
          ) : null}

          <Field
            label="Gross weight"
            value={String(trip.grossWeightLbs)}
            onChangeText={(v) => patchTrip({ grossWeightLbs: num(v) })}
            keyboardType="numeric"
            suffix="lb"
            hint="Over 80,000 lb needs an overweight permit."
          />

          <View style={s.hr} />

          <Text style={s.fieldLabel}>HAZMAT</Text>
          <Segmented
            options={HAZMAT}
            value={(trip.hazmat ?? 'none') as HazmatClass | 'none'}
            onChange={(v) => patchTrip({ hazmat: v === 'none' ? null : (v as HazmatClass) })}
            small
          />

          <View style={s.hr} />

          <Toggle
            label="Oversize / overweight"
            value={trip.oversize}
            onChange={(v) => patchTrip({ oversize: v })}
            hint="Adds per-state permits, escort cost and movement curfews."
          />
          <Toggle
            label="Lumper expected"
            value={trip.lumperExpected}
            onChange={(v) => patchTrip({ lumperExpected: v })}
            hint="You front this in cash at the receiver and get it back weeks later."
          />
          {trip.lumperExpected ? (
            <Field
              label="Lumper estimate"
              value={String(trip.lumperEstimate)}
              onChangeText={(v) => patchTrip({ lumperEstimate: num(v) })}
              keyboardType="numeric"
              suffix="$"
            />
          ) : null}
        </Card>
      </Section>

      {/* --- Pay ------------------------------------------------------------ */}
      <Section title="Pay">
        <Card>
          <Segmented
            options={[
              { value: 'per-mile', label: 'Per mile' },
              { value: 'flat', label: 'Flat rate' },
            ]}
            value={trip.rateMode}
            onChange={(v) => patchTrip({ rateMode: v, rate: v === 'flat' ? 2200 : 2.6 })}
            small
          />
          <Field
            label={trip.rateMode === 'flat' ? 'Linehaul (flat)' : 'Linehaul rate'}
            value={String(trip.rate)}
            onChangeText={(v) => patchTrip({ rate: num(v) })}
            keyboardType="decimal-pad"
            suffix={trip.rateMode === 'flat' ? '$' : '$/mi'}
            hint="Linehaul only. Fuel surcharge is calculated separately from live diesel."
          />
        </Card>
      </Section>

      {/* --- Added costs ---------------------------------------------------- */}
      <Section
        title="Unplanned costs"
        subtitle={
          addedCosts.length === 0
            ? 'A tow, a tire, a citation — add it and it flows into the total'
            : `${addedCosts.length} added · ${usd(addedTotal)}`
        }
      >
        {addedCosts.map((c) => (
          <Card key={c.id} accent={colors.red}>
            <View style={s.costHead}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700' }}>{c.label}</Body>
                <Dim>
                  {CATEGORY_LABELS[c.category]}
                  {c.reimbursable ? ' · reimbursable' : ''}
                  {c.outOfPocket ? ' · out of pocket' : ''}
                </Dim>
                {c.note ? <Dim style={{ marginTop: 4 }}>{c.note}</Dim> : null}
              </View>
              <Text style={s.costAmount}>{usd(c.amount)}</Text>
            </View>
            <Button title="Remove" variant="danger" onPress={() => removeCost(c.id)} />
          </Card>
        ))}
        <Button
          title="+ Add unplanned cost"
          variant="ghost"
          onPress={() => router.push('/add-cost?target=trip')}
        />
      </Section>

      {/* --- Generate ------------------------------------------------------- */}
      {error ? (
        <Card accent={colors.red}>
          <Body style={{ color: colors.red }}>{error}</Body>
        </Card>
      ) : null}

      {building ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.accent} />
          <Dim>Building brief…</Dim>
        </View>
      ) : (
        <Button title="Generate Trip Brief" onPress={onGenerate} />
      )}
    </Screen>
  );
}

function num(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const s = StyleSheet.create({
  truckRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  truckChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 78,
    minHeight: 52,
    justifyContent: 'center',
  },
  truckChipOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  truckChipUnit: { ...type.h3, color: colors.textDim },
  truckChipSub: { ...type.tiny, color: colors.textFaint, marginTop: 2 },

  fieldLabel: { ...type.tiny, color: colors.textFaint, textTransform: 'uppercase' },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },

  costHead: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  costAmount: { ...type.h2, color: colors.red, fontVariant: ['tabular-nums'] },

  loading: { flexDirection: 'row', gap: space.md, alignItems: 'center', justifyContent: 'center', padding: space.lg },
});
