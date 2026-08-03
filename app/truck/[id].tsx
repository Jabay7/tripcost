import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { driverName } from '../../src/calc/fleet';
import { useStore } from '../../src/store/store';
import type { DriverPayMode } from '../../src/types';
import {
  Button,
  Card,
  Dim,
  Empty,
  Field,
  Label,
  Row,
  Screen,
  Section,
  Segmented,
  StatTile,
  TileRow,
  Toggle,
} from '../../src/ui/components';
import { colors, space, type, usd, usdCents } from '../../src/ui/theme';

const num = (v: string) => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export default function TruckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fleet, updateTruck, updateTruckProfile, removeTruck, assignDriver } = useStore();
  const truck = fleet.trucks.find((t) => t.id === id);
  const seated = fleet.drivers.filter((d) => d.assignedTruckId === id);

  if (!truck) {
    return (
      <Screen>
        <Empty title="Truck not found" body="It may have been removed." />
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const p = truck.profile;
  const set = (patch: Parameters<typeof updateTruck>[1]) => updateTruck(truck.id, patch);
  const setP = (patch: Parameters<typeof updateTruckProfile>[1]) => updateTruckProfile(truck.id, patch);

  const monthlyFixed =
    p.truckPaymentMo +
    p.trailerPaymentMo +
    p.insuranceMo +
    p.permitsLicensingMo +
    p.eldTelematicsMo +
    p.accountingLegalMo +
    p.overheadMo;
  const dailyFixed = monthlyFixed / p.workingDaysPerMonth;
  const variableCpm = p.tiresCpm + p.maintenanceCpm;
  // Rough all-in cost per mile at planned utilization, for a sanity read.
  const fuelCpm = 3.78 / Math.max(1, p.mpg);
  const fixedCpm = dailyFixed / Math.max(1, truck.plannedMilesPerDay);
  const totalCpm = fuelCpm + variableCpm + fixedCpm;

  return (
    <Screen>
      <Card accent={truck.active ? colors.green : colors.textFaint}>
        <Label>Estimated cost per mile</Label>
        <Text style={s.hero}>{usdCents(totalCpm)}</Text>
        <Dim>
          At {truck.plannedMilesPerDay} mi/day and {p.mpg} mpg. You must book above this to make
          money. Target rate is set to {usdCents(truck.targetRatePerMile)}.
        </Dim>
        <TileRow>
          <StatTile label="Fuel" value={usdCents(fuelCpm)} sub="per mile" />
          <StatTile label="Variable" value={usdCents(variableCpm)} sub="per mile" />
          <StatTile label="Fixed" value={usdCents(fixedCpm)} sub="per mile" />
        </TileRow>
        <Row label="Fixed overhead" value={`${usd(monthlyFixed)}/mo`} sub={`${usd(dailyFixed)}/working day`} />
        <Row
          label="Assigned driver"
          value={seated.length > 0 ? seated.map(driverName).join(' / ') : 'Unassigned'}
          sub={seated.length > 1 ? 'Team — cost is split between them' : undefined}
          valueColor={seated.length === 0 ? colors.amber : undefined}
        />
      </Card>

      {/* --- Crew ------------------------------------------------------------ */}
      <Section title="Crew" subtitle="Seat a driver in this unit">
        <View style={s.chips}>
          {fleet.drivers.length === 0 ? (
            <Dim>No drivers on the roster yet. Add them on the Drivers tab.</Dim>
          ) : null}
          {fleet.drivers.map((d) => {
            const on = d.assignedTruckId === truck.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => assignDriver(d.id, on ? null : truck.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={[s.chipText, on && { color: colors.text }]}>{driverName(d)}</Text>
                <Text style={s.chipSub}>
                  {on ? 'seated here'
                    : d.assignedTruckId
                      ? `on Unit ${fleet.trucks.find((t) => t.id === d.assignedTruckId)?.unitNumber ?? '?'}`
                      : 'available'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* --- Identity ------------------------------------------------------- */}
      <Section title="Identity">
        <Card>
          <Field label="Unit number" value={truck.unitNumber} onChangeText={(v) => set({ unitNumber: v })} />
          <Field label="Nickname" value={truck.nickname} onChangeText={(v) => set({ nickname: v })} placeholder="Optional" />
          <View style={s.two}>
            <View style={{ flex: 1 }}>
              <Field
                label="Year"
                value={truck.year ? String(truck.year) : ''}
                onChangeText={(v) => set({ year: num(v) || null })}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Field label="Make" value={truck.make} onChangeText={(v) => set({ make: v })} />
            </View>
          </View>
          <Field label="Model" value={truck.model} onChangeText={(v) => set({ model: v })} />
          <Field label="VIN" value={truck.vin} onChangeText={(v) => set({ vin: v })} placeholder="Optional" />
          <Field label="Plate" value={truck.plate} onChangeText={(v) => set({ plate: v })} placeholder="Optional" />
          <Toggle
            label="In service"
            value={truck.active}
            onChange={(v) => set({ active: v })}
            hint="An inactive truck still accrues fixed cost but is assumed to run no miles."
          />
        </Card>
      </Section>

      {/* --- Utilization ---------------------------------------------------- */}
      <Section title="Utilization" subtitle="Drives the fleet projection when there are no recorded miles">
        <Card>
          <Field
            label="Planned miles per day"
            value={String(truck.plannedMilesPerDay)}
            onChangeText={(v) => set({ plannedMilesPerDay: num(v) })}
            keyboardType="numeric"
            suffix="mi"
          />
          <Field
            label="Target rate"
            value={String(truck.targetRatePerMile)}
            onChangeText={(v) => set({ targetRatePerMile: num(v) })}
            keyboardType="decimal-pad"
            suffix="$/mi"
          />
          <Field
            label="Working days per month"
            value={String(p.workingDaysPerMonth)}
            onChangeText={(v) => setP({ workingDaysPerMonth: num(v) })}
            keyboardType="numeric"
            hint="22 is a realistic over-the-road month."
          />
        </Card>
      </Section>

      {/* --- Performance ---------------------------------------------------- */}
      <Section title="Performance">
        <Card>
          <Field label="Fuel economy" value={String(p.mpg)} onChangeText={(v) => setP({ mpg: num(v) })} keyboardType="decimal-pad" suffix="mpg" hint="Loaded average from your own fuel receipts, not the brochure." />
          <Field label="Tank capacity" value={String(p.tankGallons)} onChangeText={(v) => setP({ tankGallons: num(v) })} keyboardType="numeric" suffix="gal" />
          <Field label="Planning speed" value={String(p.avgSpeedMph)} onChangeText={(v) => setP({ avgSpeedMph: num(v) })} keyboardType="numeric" suffix="mph" hint="Door to door including scales and traffic. 50–55 is honest." />
          <Field label="Reefer burn" value={String(p.reeferGalPerHour)} onChangeText={(v) => setP({ reeferGalPerHour: num(v) })} keyboardType="decimal-pad" suffix="gal/hr" />
          <Field label="Idle burn" value={String(p.idleGalPerHour)} onChangeText={(v) => setP({ idleGalPerHour: num(v) })} keyboardType="decimal-pad" suffix="gal/hr" hint="Main engine is about 0.9; an APU is closer to 0.2." />
          <Field label="DEF price" value={String(p.defPricePerGal)} onChangeText={(v) => setP({ defPricePerGal: num(v) })} keyboardType="decimal-pad" suffix="$/gal" />
        </Card>
      </Section>

      {/* --- Fixed costs ---------------------------------------------------- */}
      <Section title="Fixed costs" subtitle="Monthly — accrues whether the truck rolls or not">
        <Card>
          <Field label="Truck payment" value={String(p.truckPaymentMo)} onChangeText={(v) => setP({ truckPaymentMo: num(v) })} keyboardType="numeric" suffix="$/mo" />
          <Field label="Trailer payment" value={String(p.trailerPaymentMo)} onChangeText={(v) => setP({ trailerPaymentMo: num(v) })} keyboardType="numeric" suffix="$/mo" />
          <Field label="Insurance" value={String(p.insuranceMo)} onChangeText={(v) => setP({ insuranceMo: num(v) })} keyboardType="numeric" suffix="$/mo" hint="Liability, cargo, physical damage, occupational accident." />
          <Field label="Permits & licensing" value={String(p.permitsLicensingMo)} onChangeText={(v) => setP({ permitsLicensingMo: num(v) })} keyboardType="numeric" suffix="$/mo" hint="IRP plates, 2290, UCR, IFTA — annual costs divided by twelve." />
          <Field label="ELD & telematics" value={String(p.eldTelematicsMo)} onChangeText={(v) => setP({ eldTelematicsMo: num(v) })} keyboardType="numeric" suffix="$/mo" />
          <Field label="Accounting & legal" value={String(p.accountingLegalMo)} onChangeText={(v) => setP({ accountingLegalMo: num(v) })} keyboardType="numeric" suffix="$/mo" />
          <Field label="Other overhead" value={String(p.overheadMo)} onChangeText={(v) => setP({ overheadMo: num(v) })} keyboardType="numeric" suffix="$/mo" />
        </Card>
      </Section>

      {/* --- Variable costs -------------------------------------------------- */}
      <Section title="Variable costs" subtitle="Per mile">
        <Card>
          <Field label="Tires" value={String(p.tiresCpm)} onChangeText={(v) => setP({ tiresCpm: num(v) })} keyboardType="decimal-pad" suffix="$/mi" hint="Industry average runs near $0.046." />
          <Field label="Maintenance & repair" value={String(p.maintenanceCpm)} onChangeText={(v) => setP({ maintenanceCpm: num(v) })} keyboardType="decimal-pad" suffix="$/mi" hint="Industry average runs near $0.20. Older trucks run well above it." />
        </Card>
      </Section>

      {/* --- Driver ---------------------------------------------------------- */}
      <Section title="Driver pay">
        <Card>
          <Segmented<DriverPayMode>
            options={[
              { value: 'owner-operator', label: 'Owner-op' },
              { value: 'per-mile', label: 'Per mile' },
              { value: 'percent-of-linehaul', label: 'Percent' },
            ]}
            value={p.driverPayMode}
            onChange={(v) => setP({ driverPayMode: v })}
            small
          />
          {p.driverPayMode === 'owner-operator' ? (
            <Dim>
              No wage line. What would be driver pay shows up as profit, which is how an
              owner-operator's books actually work.
            </Dim>
          ) : null}
          {p.driverPayMode === 'per-mile' ? (
            <Field label="Driver rate" value={String(p.driverCpm)} onChangeText={(v) => setP({ driverCpm: num(v) })} keyboardType="decimal-pad" suffix="$/mi" />
          ) : null}
          {p.driverPayMode === 'percent-of-linehaul' ? (
            <Field label="Driver share" value={String(p.driverPercent)} onChangeText={(v) => setP({ driverPercent: num(v) })} keyboardType="decimal-pad" suffix="%" />
          ) : null}
          <Field label="Per diem" value={String(p.perDiemPerDay)} onChangeText={(v) => setP({ perDiemPerDay: num(v) })} keyboardType="numeric" suffix="$/day" hint="IRS special rate for transportation workers." />
        </Card>
      </Section>

      {/* --- Business -------------------------------------------------------- */}
      <Section title="Money off the top">
        <Card>
          <Field label="Factoring" value={String(p.factoringPercent)} onChangeText={(v) => setP({ factoringPercent: num(v) })} keyboardType="decimal-pad" suffix="%" hint="Set to zero if you wait for the broker to pay." />
          <Field label="Dispatch" value={String(p.dispatchPercent)} onChangeText={(v) => setP({ dispatchPercent: num(v) })} keyboardType="decimal-pad" suffix="%" />
        </Card>
      </Section>

      {/* --- HOS -------------------------------------------------------------- */}
      <Section title="Hours of service">
        <Card>
          <Segmented
            options={[
              { value: '70', label: '70 hr / 8 day' },
              { value: '60', label: '60 hr / 7 day' },
            ]}
            value={String(p.hosCycle)}
            onChange={(v) => setP({ hosCycle: Number(v) as 60 | 70 })}
            small
          />
          <Field
            label="Hours already used today"
            value={String(p.hoursAlreadyOnDuty)}
            onChangeText={(v) => setP({ hoursAlreadyOnDuty: num(v) })}
            keyboardType="decimal-pad"
            suffix="hr"
            hint="On-duty time already burned in the current 14-hour window at departure."
          />
        </Card>
      </Section>

      <Button title="Done" onPress={() => router.back()} />
      <Button
        title="Remove this truck"
        variant="danger"
        onPress={() => {
          removeTruck(truck.id);
          router.back();
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { fontSize: 40, fontWeight: '900', color: colors.text, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  two: { flexDirection: 'row', gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  chipText: { ...type.small, color: colors.textDim, fontWeight: '700' },
  chipSub: { ...type.tiny, color: colors.textFaint, marginTop: 2 },
});
