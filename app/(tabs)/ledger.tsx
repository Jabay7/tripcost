import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_LABELS } from '../../src/data/incidents';
import { useStore } from '../../src/store/store';
import {
  Button,
  Card,
  Dim,
  Empty,
  Label,
  Row,
  Screen,
  Section,
  Segmented,
  StatTile,
  Pill,
  TileRow,
} from '../../src/ui/components';
import { colors, shortDate, space, type, usd } from '../../src/ui/theme';

type Filter = 'all' | 'expense' | 'revenue';

export default function LedgerScreen() {
  const { ledger, fleet, removeLedgerEntry } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [truckFilter, setTruckFilter] = useState<string>('all');

  const truckName = (id: string) => {
    const t = fleet.trucks.find((x) => x.id === id);
    return t ? `Unit ${t.unitNumber}` : 'Unknown unit';
  };

  const visible = useMemo(() => {
    return ledger
      .filter((e) => (filter === 'all' ? true : e.kind === filter))
      .filter((e) => (truckFilter === 'all' ? true : e.truckId === truckFilter))
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledger, filter, truckFilter]);

  const totals = useMemo(() => {
    const expense = visible.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
    const revenue = visible.filter((e) => e.kind === 'revenue').reduce((s, e) => s + e.amount, 0);
    return { expense, revenue, net: revenue - expense };
  }, [visible]);

  return (
    <Screen>
      <Section title="Ledger" subtitle="Real money in and out, by truck">
        <TileRow>
          <StatTile label="Expenses" value={usd(totals.expense)} color={colors.red} />
          <StatTile label="Revenue" value={usd(totals.revenue)} color={colors.green} />
          <StatTile
            label="Net"
            value={usd(totals.net)}
            color={totals.net >= 0 ? colors.profit : colors.loss}
          />
        </TileRow>
      </Section>

      <Section title="Filter">
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Expenses' },
            { value: 'revenue', label: 'Revenue' },
          ]}
          value={filter}
          onChange={setFilter}
          small
        />
        <Segmented
          options={[
            { value: 'all', label: 'All trucks' },
            ...fleet.trucks.map((t) => ({ value: t.id, label: t.unitNumber })),
          ]}
          value={truckFilter}
          onChange={setTruckFilter}
          small
        />
      </Section>

      <Button title="📷  Scan a bill or invoice" onPress={() => router.push('/scan')} />
      <Button
        title="+ Record a cost by hand"
        variant="secondary"
        onPress={() => router.push('/add-cost?target=ledger')}
      />

      <Section title="Entries" subtitle={`${visible.length} record${visible.length === 1 ? '' : 's'}`}>
        {visible.length === 0 ? (
          <Empty
            title="Nothing recorded"
            body="Log tows, road calls, citations and completed loads here. The fleet report uses these as actuals rather than estimates."
          />
        ) : null}

        {visible.map((e) => (
          <Card key={e.id} accent={e.kind === 'expense' ? colors.red : colors.green}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{e.label}</Text>
                <Dim>
                  {truckName(e.truckId)} · {shortDate(e.date)}
                  {e.miles > 0 ? ` · ${e.miles.toLocaleString()} mi` : ''}
                </Dim>
              </View>
              <Text style={[s.amount, { color: e.kind === 'expense' ? colors.red : colors.green }]}>
                {e.kind === 'expense' ? '−' : '+'}
                {usd(e.amount)}
              </Text>
            </View>
            <View style={s.tags}>
              <Pill
                text={(
                  CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS] ?? e.category
                ).toUpperCase()}
                color={colors.textDim}
              />
            </View>
            {e.note ? <Dim>{e.note}</Dim> : null}
            <Pressable
              onPress={() => removeLedgerEntry(e.id)}
              accessibilityRole="button"
              style={s.delete}
            >
              <Text style={s.deleteText}>Delete</Text>
            </Pressable>
          </Card>
        ))}
      </Section>

      <Card>
        <Label>Why log it</Label>
        <Dim>
          A modeled maintenance cost per mile is an average. What actually happened is a $1,150 tow
          on a Tuesday. Recording real events is what turns the fleet report from a projection into
          your books — and it is how you find out that one truck is eating the fleet's margin.
        </Dim>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { ...type.h3, color: colors.text },
  amount: { ...type.h2, fontVariant: ['tabular-nums'] },
  tags: { flexDirection: 'row', gap: space.xs },
  delete: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' },
  deleteText: { ...type.small, color: colors.textFaint, fontWeight: '700' },
});
