import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { complianceAlerts, driverName } from '../../src/calc/fleet';
import { makeDriver, useStore } from '../../src/store/store';
import { ENDORSEMENT_LABELS } from '../../src/types';
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
  Pill,
} from '../../src/ui/components';
import { InviteCard } from '../../src/ui/InviteCard';
import { colors, shortDate, space, type } from '../../src/ui/theme';

export default function DriversScreen() {
  const { fleet, addDriver, updateCompany } = useStore();

  const alerts = useMemo(() => complianceAlerts(fleet.drivers, new Date()), [fleet.drivers]);
  const alertsByDriver = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) m.set(a.driverId, (m.get(a.driverId) ?? 0) + 1);
    return m;
  }, [alerts]);

  const onAdd = () => {
    const d = makeDriver();
    addDriver(d);
    router.push(`/driver/${d.id}`);
  };

  const truckLabel = (truckId: string | null) => {
    if (!truckId) return 'Unassigned';
    const t = fleet.trucks.find((x) => x.id === truckId);
    return t ? `Unit ${t.unitNumber}` : 'Unassigned';
  };

  const active = fleet.drivers.filter((d) => d.status === 'active');
  const seated = active.filter((d) => d.assignedTruckId);

  return (
    <Screen>
      {/* --- Company (the admin at the top) ---------------------------------- */}
      <Section title="Carrier" subtitle="Trucks and drivers both hang off this account">
        <Card>
          <Field
            label="Company name"
            value={fleet.company.name}
            onChangeText={(v) => updateCompany({ name: v })}
          />
          <View style={s.two}>
            <View style={{ flex: 1 }}>
              <Field
                label="USDOT"
                value={fleet.company.dotNumber}
                onChangeText={(v) => updateCompany({ dotNumber: v })}
                keyboardType="numeric"
                placeholder="0000000"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="MC number"
                value={fleet.company.mcNumber}
                onChangeText={(v) => updateCompany({ mcNumber: v })}
                placeholder="MC-000000"
              />
            </View>
          </View>
          <Field
            label="Dispatch contact"
            value={fleet.company.contactName}
            onChangeText={(v) => updateCompany({ contactName: v })}
            placeholder="Who drivers call"
          />
          <Field
            label="Dispatch phone"
            value={fleet.company.contactPhone}
            onChangeText={(v) => updateCompany({ contactPhone: v })}
            placeholder="(000) 000-0000"
          />
        </Card>
      </Section>

      {/* --- Roster ---------------------------------------------------------- */}
      <Section
        title="Roster"
        subtitle={`${active.length} active · ${seated.length} seated · ${fleet.drivers.length} total`}
      >
        {fleet.drivers.length === 0 ? (
          <Empty
            title="No drivers"
            body="Add drivers and assign them to a unit. Cost, miles and compliance all roll up per driver."
          />
        ) : null}

        {fleet.drivers.map((d) => {
          const alertCount = alertsByDriver.get(d.id) ?? 0;
          const unassigned = !d.assignedTruckId;
          return (
            <Pressable
              key={d.id}
              onPress={() => router.push(`/driver/${d.id}`)}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <Card
                accent={
                  alertCount > 0 ? colors.amber
                  : d.status === 'active' ? colors.green
                  : colors.textFaint
                }
              >
                <View style={s.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{driverName(d)}</Text>
                    <Dim>
                      {truckLabel(d.assignedTruckId)}
                      {d.cdlState ? ` · CDL ${d.cdlClass} ${d.cdlState}` : ''}
                      {d.phone ? ` · ${d.phone}` : ''}
                    </Dim>
                  </View>
                  {d.status !== 'active' ? (
                    <Pill text={d.status.replace('-', ' ').toUpperCase()} color={colors.amber} />
                  ) : null}
                  {unassigned && d.status === 'active' ? (
                    <Pill text="BENCH" color={colors.textFaint} />
                  ) : null}
                </View>

                {d.endorsements.length > 0 ? (
                  <View style={s.tags}>
                    {d.endorsements.map((e) => (
                      <Pill key={e} text={`${e} · ${ENDORSEMENT_LABELS[e]}`} color={colors.blue} />
                    ))}
                  </View>
                ) : null}

                <Row label="CDL expires" value={d.cdlExpires ? shortDate(d.cdlExpires) : '—'} />
                <Row
                  label="Medical card"
                  value={d.medicalCardExpires ? shortDate(d.medicalCardExpires) : '—'}
                />
                <Row
                  label="Pay"
                  value={
                    d.payMode === 'per-mile' ? `$${d.payRate.toFixed(2)}/mi`
                    : d.payMode === 'percent-of-linehaul' ? `${d.payRate}%`
                    : 'Owner-operator'
                  }
                />

                {alertCount > 0 ? (
                  <View style={s.alertBanner}>
                    <Text style={s.alertText}>
                      {alertCount} compliance item{alertCount === 1 ? '' : 's'} need
                      {alertCount === 1 ? 's' : ''} attention.
                    </Text>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })}

        <Button title="+ Add driver" onPress={onAdd} />
      </Section>

      <InviteCard />

      <Card>
        <Label>Assignment</Label>
        <Body>
          A driver is seated in one unit at a time, and two drivers on the same unit are treated as a
          team — that truck's cost is split between them rather than counted twice. Benched drivers
          carry no operating cost, but the truck they left still owes its payment.
        </Body>
      </Card>

      <Card>
        <Label>New to this?</Label>
        <Body>
          The walkthrough covers what each part is for and the two or three things people usually get
          wrong. About two minutes.
        </Body>
        <Button
          title="How this app works"
          variant="secondary"
          onPress={() => router.push('/walkthrough')}
        />
      </Card>

      <Card accent={colors.amber}>
        <Label>What this app is not</Label>
        <Body>
          TripCost is a planning tool. It is not an ELD, not a system of record for hours of
          service, and not legal, tax, or financial advice.
        </Body>
        <Dim>
          The hours-of-service timeline models the 11-hour driving limit, the 14-hour window, the
          30-minute break and the 10-hour reset. It does not model sleeper-berth splits, the 34-hour
          restart, or the short-haul and adverse-conditions exceptions — all of which give a driver
          more time, so the plan is the conservative case. Your ELD is the authority on your
          available hours, and the driver is the authority on whether a load can be run safely.
          Routing is a straight-line estimate and is not truck-legal until a truck router is
          connected: verify bridge clearances, weight limits and restricted roads before dispatch.
        </Dim>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  name: { ...type.h2, color: colors.text },
  tags: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  two: { flexDirection: 'row', gap: space.sm },
  alertBanner: {
    backgroundColor: colors.amberDim,
    borderRadius: 6,
    padding: space.md,
    marginTop: space.xs,
  },
  alertText: { ...type.small, color: colors.amber, lineHeight: 18 },
});
