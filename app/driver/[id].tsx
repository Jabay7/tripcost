import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { complianceAlerts, driverName } from '../../src/calc/fleet';
import { useStore } from '../../src/store/store';
import {
  ENDORSEMENT_LABELS,
  type DriverPayMode,
  type DriverStatus,
  type Endorsement,
} from '../../src/types';
import {
  Body,
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
  Pill,
} from '../../src/ui/components';
import { colors, radius, shortDate, space, type } from '../../src/ui/theme';

const ENDORSEMENTS: Endorsement[] = ['H', 'N', 'X', 'T', 'P', 'S'];

const num = (v: string) => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Nudges a stored ISO date by whole months, for credential expiry entry. */
function shiftMonths(iso: string, months: number): string {
  const d = iso ? new Date(iso) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export default function DriverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fleet, updateDriver, removeDriver, assignDriver } = useStore();
  const driver = fleet.drivers.find((d) => d.id === id);

  if (!driver) {
    return (
      <Screen>
        <Empty title="Driver not found" body="They may have been removed from the roster." />
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const set = (patch: Parameters<typeof updateDriver>[1]) => updateDriver(driver.id, patch);
  const alerts = complianceAlerts([driver], new Date());

  const toggleEndorsement = (e: Endorsement) =>
    set({
      endorsements: driver.endorsements.includes(e)
        ? driver.endorsements.filter((x) => x !== e)
        : [...driver.endorsements, e],
    });

  const assignedTruck = fleet.trucks.find((t) => t.id === driver.assignedTruckId);
  const teammates = fleet.drivers.filter(
    (d) => d.id !== driver.id && d.assignedTruckId && d.assignedTruckId === driver.assignedTruckId,
  );

  return (
    <Screen>
      <Card accent={driver.status === 'active' ? colors.green : colors.textFaint}>
        <Text style={s.hero}>{driverName(driver)}</Text>
        <Dim>
          {assignedTruck ? `Seated in Unit ${assignedTruck.unitNumber}` : 'Not assigned to a unit'}
          {teammates.length > 0 ? ` · team with ${teammates.map(driverName).join(', ')}` : ''}
        </Dim>
        {alerts.map((a, i) => (
          <View
            key={i}
            style={[
              s.alert,
              { backgroundColor: a.severity === 'expired' ? colors.redDim : colors.amberDim },
            ]}
          >
            <Text
              style={[
                s.alertText,
                { color: a.severity === 'expired' ? colors.red : colors.amber },
              ]}
            >
              {a.message}
            </Text>
          </View>
        ))}
      </Card>

      {/* --- Identity -------------------------------------------------------- */}
      <Section title="Driver">
        <Card>
          <View style={s.two}>
            <View style={{ flex: 1 }}>
              <Field label="First name" value={driver.firstName} onChangeText={(v) => set({ firstName: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Last name" value={driver.lastName} onChangeText={(v) => set({ lastName: v })} />
            </View>
          </View>
          <Field label="Phone" value={driver.phone} onChangeText={(v) => set({ phone: v })} placeholder="(000) 000-0000" />
          <Field label="Email" value={driver.email} onChangeText={(v) => set({ email: v })} placeholder="Optional" />

          <Label>STATUS</Label>
          <Segmented<DriverStatus>
            options={[
              { value: 'active', label: 'Active' },
              { value: 'on-leave', label: 'On leave' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            value={driver.status}
            onChange={(v) => set({ status: v })}
            small
          />
        </Card>
      </Section>

      {/* --- Assignment ------------------------------------------------------ */}
      <Section title="Truck assignment" subtitle="One unit at a time; two drivers on a unit is a team">
        <View style={s.chips}>
          <Pressable
            onPress={() => assignDriver(driver.id, null)}
            accessibilityRole="button"
            accessibilityState={{ selected: !driver.assignedTruckId }}
            style={[s.chip, !driver.assignedTruckId && s.chipOn]}
          >
            <Text style={[s.chipText, !driver.assignedTruckId && { color: colors.text }]}>
              Unassigned
            </Text>
          </Pressable>
          {fleet.trucks.map((t) => {
            const on = t.id === driver.assignedTruckId;
            const others = fleet.drivers.filter(
              (d) => d.id !== driver.id && d.assignedTruckId === t.id,
            );
            return (
              <Pressable
                key={t.id}
                onPress={() => assignDriver(driver.id, t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={[s.chipText, on && { color: colors.text }]}>Unit {t.unitNumber}</Text>
                <Text style={s.chipSub}>
                  {others.length > 0 ? `${others.length} seated` : 'open'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* --- Credentials ------------------------------------------------------ */}
      <Section title="CDL & credentials">
        <Card>
          <Field label="CDL number" value={driver.cdlNumber} onChangeText={(v) => set({ cdlNumber: v })} />
          <View style={s.two}>
            <View style={{ flex: 1 }}>
              <Field
                label="Issuing state"
                value={driver.cdlState}
                onChangeText={(v) => set({ cdlState: v.toUpperCase().slice(0, 2) as typeof driver.cdlState })}
                placeholder="TX"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Label>CLASS</Label>
              <Segmented
                options={[
                  { value: 'A', label: 'A' },
                  { value: 'B', label: 'B' },
                  { value: 'C', label: 'C' },
                ]}
                value={driver.cdlClass}
                onChange={(v) => set({ cdlClass: v as 'A' | 'B' | 'C' })}
                small
              />
            </View>
          </View>

          <Label>ENDORSEMENTS</Label>
          <View style={s.chips}>
            {ENDORSEMENTS.map((e) => {
              const on = driver.endorsements.includes(e);
              return (
                <Pressable
                  key={e}
                  onPress={() => toggleEndorsement(e)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[s.chip, on && s.chipOn]}
                >
                  <Text style={[s.chipText, on && { color: colors.text }]}>{e}</Text>
                  <Text style={s.chipSub}>{ENDORSEMENT_LABELS[e]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Dim>
            Endorsements gate what this driver can legally haul. Hazmat also requires a TSA security
            threat assessment that has to be renewed on its own clock.
          </Dim>

          <View style={s.hr} />

          <ExpiryField
            label="CDL expires"
            value={driver.cdlExpires}
            onChange={(v) => set({ cdlExpires: v })}
          />
          <ExpiryField
            label="DOT medical card expires"
            value={driver.medicalCardExpires}
            onChange={(v) => set({ medicalCardExpires: v })}
          />
          <ExpiryField
            label="Hire date"
            value={driver.hireDate}
            onChange={(v) => set({ hireDate: v })}
          />
        </Card>
      </Section>

      {/* --- Pay -------------------------------------------------------------- */}
      <Section title="Pay">
        <Card>
          <Segmented<DriverPayMode>
            options={[
              { value: 'per-mile', label: 'Per mile' },
              { value: 'percent-of-linehaul', label: 'Percent' },
              { value: 'owner-operator', label: 'Owner-op' },
            ]}
            value={driver.payMode}
            onChange={(v) => set({ payMode: v })}
            small
          />
          {driver.payMode !== 'owner-operator' ? (
            <Field
              label={driver.payMode === 'per-mile' ? 'Rate' : 'Share of linehaul'}
              value={String(driver.payRate)}
              onChangeText={(v) => set({ payRate: num(v) })}
              keyboardType="decimal-pad"
              suffix={driver.payMode === 'per-mile' ? '$/mi' : '%'}
            />
          ) : (
            <Dim>This driver owns the truck. Their pay is the profit, not a cost line.</Dim>
          )}
          <Label>HOS CYCLE</Label>
          <Segmented
            options={[
              { value: '70', label: '70 hr / 8 day' },
              { value: '60', label: '60 hr / 7 day' },
            ]}
            value={String(driver.hosCycle)}
            onChange={(v) => set({ hosCycle: Number(v) as 60 | 70 })}
            small
          />
          <Field
            label="Notes"
            value={driver.notes}
            onChangeText={(v) => set({ notes: v })}
            placeholder="Restrictions, preferences, anything dispatch should know"
          />
        </Card>
      </Section>

      <Button title="Done" onPress={() => router.back()} />
      <Button
        title="Remove from roster"
        variant="danger"
        onPress={() => {
          removeDriver(driver.id);
          router.back();
        }}
      />
    </Screen>
  );
}

/**
 * Month-granularity date entry. Credentials expire on a date months or years
 * out, so stepping by month is faster than any picker and needs no native
 * module.
 */
function ExpiryField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <View style={s.expiry}>
        <Pressable
          onPress={() => onChange(shiftMonths(value, -1))}
          accessibilityRole="button"
          accessibilityLabel={`${label} one month earlier`}
          style={s.expiryBtn}
        >
          <Text style={s.expiryBtnText}>−</Text>
        </Pressable>
        <Text style={s.expiryValue}>{value ? shortDate(value) : '—'}</Text>
        <Text style={s.expiryYear}>{value ? new Date(value).getFullYear() : ''}</Text>
        <Pressable
          onPress={() => onChange(shiftMonths(value, 1))}
          accessibilityRole="button"
          accessibilityLabel={`${label} one month later`}
          style={s.expiryBtn}
        >
          <Text style={s.expiryBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { ...type.hero, color: colors.text },
  two: { flexDirection: 'row', gap: space.sm },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },

  alert: { borderRadius: radius.sm, padding: space.md, marginTop: space.xs },
  alertText: { ...type.small, lineHeight: 18, fontWeight: '600' },

  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  chipText: { ...type.small, color: colors.textDim, fontWeight: '700' },
  chipSub: { ...type.tiny, color: colors.textFaint, marginTop: 2 },

  expiry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expiryBtn: { width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  expiryBtnText: { color: colors.text, fontSize: 24, fontWeight: '700', lineHeight: 28 },
  expiryValue: { ...type.h3, color: colors.text, flex: 1, textAlign: 'center' },
  expiryYear: { ...type.small, color: colors.textFaint, marginRight: space.sm },
});
