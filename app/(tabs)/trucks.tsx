import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { driverName } from '../../src/calc/fleet';
import { makeTruck, useStore } from '../../src/store/store';
import {
  Body,
  Button,
  Card,
  Dim,
  Empty,
  Label,
  Row,
  Screen,
  Section,
  Pill,
} from '../../src/ui/components';
import { colors, space, type, usd, usdCents } from '../../src/ui/theme';

export default function TrucksScreen() {
  const { fleet, addTruck, activeTruckId, setActiveTruck } = useStore();

  const onAdd = () => {
    // Next unit number, so a fleet growing to 20 trucks does not fight the UI.
    const nums = fleet.trucks
      .map((t) => parseInt(t.unitNumber, 10))
      .filter((n) => Number.isFinite(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 101;
    const t = makeTruck(String(next));
    addTruck(t);
    router.push(`/truck/${t.id}`);
  };

  return (
    <Screen>
      <Section title="Fleet" subtitle={`${fleet.trucks.length} truck${fleet.trucks.length === 1 ? '' : 's'}`}>
        {fleet.trucks.length === 0 ? (
          <Empty title="No trucks" body="Add your first truck to start costing trips and tracking the fleet." />
        ) : null}

        {fleet.trucks.map((t) => {
          const p = t.profile;
          const monthlyFixed =
            p.truckPaymentMo +
            p.trailerPaymentMo +
            p.insuranceMo +
            p.permitsLicensingMo +
            p.eldTelematicsMo +
            p.accountingLegalMo +
            p.overheadMo;
          const variableCpm = p.tiresCpm + p.maintenanceCpm;
          const isActive = t.id === (activeTruckId ?? fleet.trucks[0]?.id);
          const seated = fleet.drivers.filter((d) => d.assignedTruckId === t.id);

          return (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/truck/${t.id}`)}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <Card accent={t.active ? colors.green : colors.textFaint}>
                <View style={s.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>
                      Unit {t.unitNumber}
                      {t.nickname ? ` — ${t.nickname}` : ''}
                    </Text>
                    <Dim>
                      {[t.year || '', t.make, t.model].filter(Boolean).join(' ') || 'No equipment details'}
                      {seated.length > 0 ? ` · ${seated.map(driverName).join(' / ')}` : ' · unassigned'}
                    </Dim>
                  </View>
                  {isActive ? <Pill text="PLANNING" color={colors.accent} /> : null}
                  {!t.active ? <Pill text="INACTIVE" color={colors.textFaint} /> : null}
                </View>

                <Row label="Fuel economy" value={`${p.mpg} mpg`} />
                <Row label="Fixed overhead" value={`${usd(monthlyFixed)}/mo`} />
                <Row label="Variable" value={`${usdCents(variableCpm)}/mi`} sub="Tires + maintenance" />
                <Row label="Planned utilization" value={`${t.plannedMilesPerDay} mi/day`} />
                <Row label="Target rate" value={`${usdCents(t.targetRatePerMile)}/mi`} />

                {!isActive ? (
                  <Button
                    title="Use for trip planning"
                    variant="secondary"
                    onPress={() => setActiveTruck(t.id)}
                  />
                ) : null}
              </Card>
            </Pressable>
          );
        })}

        <Button title="+ Add truck" onPress={onAdd} />
      </Section>

      <Card>
        <Label>Why per-truck cost bases matter</Label>
        <Body>
          A 2019 truck at 6.1 mpg with a $0.26/mile maintenance bill is a completely different
          business than a 2023 truck at 7.1 mpg still under warranty. Averaging them hides which one
          is actually paying for itself.
        </Body>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { ...type.h2, color: colors.text },
});
