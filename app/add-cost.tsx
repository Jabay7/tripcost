import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { driverName } from '../src/calc/fleet';
import { INCIDENT_TEMPLATES, type IncidentTemplate } from '../src/data/incidents';
import { newId, useStore } from '../src/store/store';
import { makeAddedCost, useTrip } from '../src/store/trip';
import {
  Body,
  Button,
  Card,
  Dim,
  Field,
  Label,
  Screen,
  Section,
  Toggle,
} from '../src/ui/components';
import { colors, radius, space, type, usd } from '../src/ui/theme';

export default function AddCostScreen() {
  const { target } = useLocalSearchParams<{ target?: string }>();
  const toLedger = target === 'ledger';

  const { addCost } = useTrip();
  const { fleet, activeTruckId, addLedgerEntry } = useStore();

  const [template, setTemplate] = useState<IncidentTemplate>(INCIDENT_TEMPLATES[0]);
  const [label, setLabel] = useState(INCIDENT_TEMPLATES[0].label);
  const [amount, setAmount] = useState(String(INCIDENT_TEMPLATES[0].typical));
  const [note, setNote] = useState('');
  const [outOfPocket, setOutOfPocket] = useState(true);
  const [reimbursable, setReimbursable] = useState(INCIDENT_TEMPLATES[0].reimbursable);
  const [truckId, setTruckId] = useState(activeTruckId ?? fleet.trucks[0]?.id ?? '');

  const pick = (t: IncidentTemplate) => {
    setTemplate(t);
    setLabel(t.label);
    setAmount(t.typical > 0 ? String(t.typical) : '');
    setReimbursable(t.reimbursable);
  };

  const amountNum = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
  const valid = amountNum > 0 && label.trim().length > 0 && (!toLedger || truckId);

  const save = () => {
    if (!valid) return;
    if (toLedger) {
      addLedgerEntry({
        id: newId('led'),
        truckId,
        date: new Date().toISOString(),
        kind: 'expense',
        category: template.category,
        label: label.trim(),
        amount: amountNum,
        miles: 0,
        note: note.trim(),
      });
    } else {
      addCost(
        makeAddedCost({
          label: label.trim(),
          amount: amountNum,
          category: template.category,
          note: note.trim(),
          outOfPocket,
          reimbursable,
        }),
      );
    }
    router.back();
  };

  return (
    <Screen>
      <Section
        title={toLedger ? 'Record a cost' : 'Add to this trip'}
        subtitle={
          toLedger
            ? 'Goes into the ledger and the fleet report as an actual'
            : 'Rolls into the trip total and cash-to-float'
        }
      >
        <Label>What happened</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {INCIDENT_TEMPLATES.map((t) => {
            const on = t.key === template.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => pick(t)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={[s.chipText, on && { color: colors.text }]}>{t.label}</Text>
                {t.typical > 0 ? (
                  <Text style={s.chipSub}>~{usd(t.typical)}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {template.hint ? (
          <Card>
            <Dim>{template.hint}</Dim>
            {template.typical > 0 ? (
              <Dim style={{ marginTop: 4, color: colors.textFaint }}>
                Typical range {usd(template.low)} – {usd(template.high)}.
              </Dim>
            ) : null}
          </Card>
        ) : null}
      </Section>

      <Section title="Details">
        <Card>
          <Field label="Description" value={label} onChangeText={setLabel} placeholder="What was it" />
          <Field
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            suffix="$"
            placeholder="0"
          />
          <Field
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Where, what, who — the detail you will want in three months"
          />
        </Card>
      </Section>

      {toLedger ? (
        <Section title="Truck">
          <View style={s.chips}>
            {fleet.trucks.map((t) => {
              const on = t.id === truckId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTruckId(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[s.chip, on && s.chipOn]}
                >
                  <Text style={[s.chipText, on && { color: colors.text }]}>Unit {t.unitNumber}</Text>
                  {(() => {
                    const seated = fleet.drivers.filter((d) => d.assignedTruckId === t.id);
                    return seated.length > 0 ? (
                      <Text style={s.chipSub}>{seated.map(driverName).join(' / ')}</Text>
                    ) : null;
                  })()}
                </Pressable>
              );
            })}
          </View>
        </Section>
      ) : (
        <Section title="How it hits you">
          <Card>
            <Toggle
              label="Paid out of pocket"
              value={outOfPocket}
              onChange={setOutOfPocket}
              hint="Counts toward the cash you must float before settlement."
            />
            <Toggle
              label="Reimbursable"
              value={reimbursable}
              onChange={setReimbursable}
              hint="Broker, shipper or insurance is expected to pay it back. Keep the receipt."
            />
          </Card>
        </Section>
      )}

      <Card accent={colors.red}>
        <Label>Adding</Label>
        <Text style={s.total}>{usd(amountNum)}</Text>
        <Body>{label || 'Unnamed cost'}</Body>
      </Card>

      <Button title={toLedger ? 'Record cost' : 'Add to trip'} onPress={save} disabled={!valid} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', paddingRight: space.lg },
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

  total: { fontSize: 34, fontWeight: '900', color: colors.red, fontVariant: ['tabular-nums'] },
});
