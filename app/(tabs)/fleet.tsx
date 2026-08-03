import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildFleetReport, PERIOD_LABELS } from '../../src/calc/fleet';
import { useStore } from '../../src/store/store';
import type { DriverCostSummary, Period, TruckCostSummary } from '../../src/types';
import {
  Bar,
  Body,
  Button,
  Card,
  CheckRow,
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
import {
  categoryColor,
  colors,
  radius,
  space,
  type,
  usd,
  usdCents,
} from '../../src/ui/theme';

/** Blended national diesel used for fleet projections when no fuel receipts exist. */
const FLEET_FUEL_PRICE = 3.78;

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Qtr' },
  { value: 'year', label: 'Year' },
];

export default function FleetScreen() {
  const { fleet, ledger } = useStore();
  const [period, setPeriod] = useState<Period>('month');
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<'truck' | 'driver'>('truck');

  const report = useMemo(
    () =>
      buildFleetReport(
        fleet.trucks,
        ledger,
        period,
        selected,
        FLEET_FUEL_PRICE,
        new Date(),
        fleet.drivers,
      ),
    [fleet.trucks, fleet.drivers, ledger, period, selected],
  );

  if (fleet.trucks.length === 0) {
    return (
      <Screen>
        <Empty title="No trucks" body="Add trucks on the Trucks tab to see fleet costs." />
      </Screen>
    );
  }

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const isSubset = selected.length > 0 && selected.length < fleet.trucks.length;
  const c = report.combined;

  return (
    <Screen>
      {/* --- Company header -------------------------------------------------- */}
      <View>
        <Text style={s.company}>{fleet.company.name}</Text>
        <Dim>
          {[
            fleet.company.dotNumber ? `USDOT ${fleet.company.dotNumber}` : null,
            fleet.company.mcNumber ? `MC ${fleet.company.mcNumber}` : null,
            `${fleet.trucks.length} truck${fleet.trucks.length === 1 ? '' : 's'}`,
            `${fleet.drivers.filter((d) => d.status === 'active').length} active driver${
              fleet.drivers.filter((d) => d.status === 'active').length === 1 ? '' : 's'
            }`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Dim>
      </View>

      {/* --- Compliance ------------------------------------------------------ */}
      {report.complianceAlerts.length > 0 ? (
        <Section title="Compliance" subtitle="CDL and DOT medical certificates">
          {report.complianceAlerts.map((a, i) => (
            <Card
              key={i}
              accent={
                a.severity === 'expired' ? colors.red
                : a.severity === 'critical' ? colors.amber
                : colors.blue
              }
            >
              <View style={s.truckHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.alertName}>{a.driverName}</Text>
                  <Dim>{a.message}</Dim>
                </View>
                <Pill
                  text={a.severity.toUpperCase()}
                  color={
                    a.severity === 'expired' ? colors.red
                    : a.severity === 'critical' ? colors.amber
                    : colors.blue
                  }
                  bg={colors.surfaceAlt}
                />
              </View>
            </Card>
          ))}
        </Section>
      ) : null}

      {/* --- Period --------------------------------------------------------- */}
      <Section title="Period" subtitle={PERIOD_LABELS[period]}>
        <Segmented options={PERIODS} value={period} onChange={setPeriod} small />
      </Section>

      {/* --- Truck selection ------------------------------------------------ */}
      <Section
        title="Trucks"
        subtitle={
          isSubset
            ? `${selected.length} of ${fleet.trucks.length} selected`
            : `All ${fleet.trucks.length} trucks`
        }
        right={
          selected.length > 0 ? (
            <Button title="Clear" variant="ghost" onPress={() => setSelected([])} style={s.clearBtn} />
          ) : undefined
        }
      >
        {fleet.trucks.map((t) => {
          const sum = report.perTruck.find((p) => p.truckId === t.id);
          const all = selected.length === 0;
          return (
            <CheckRow
              key={t.id}
              checked={all || selected.includes(t.id)}
              onToggle={() => toggle(t.id)}
              title={t.nickname ? `Unit ${t.unitNumber} — ${t.nickname}` : `Unit ${t.unitNumber}`}
              subtitle={
                [t.year || '', t.make, t.model].filter(Boolean).join(' ') +
                (sum && sum.driverNames.length > 0
                  ? ` · ${sum.driverNames.join(' / ')}`
                  : ' · unassigned') +
                (t.active ? '' : ' · INACTIVE')
              }
              right={
                sum ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.chipCost}>{usd(sum.totalCost)}</Text>
                    <Text style={s.chipCpm}>{usdCents(sum.costPerMile)}/mi</Text>
                  </View>
                ) : undefined
              }
            />
          );
        })}
        <Dim>
          Tap trucks to scope the report. With none selected the whole fleet is shown.
        </Dim>
      </Section>

      {/* --- Headline ------------------------------------------------------- */}
      <Section title={isSubset ? 'Selected trucks' : 'Whole fleet'} subtitle={PERIOD_LABELS[period]}>
        <Card>
          <Label>Total operating cost</Label>
          <Text style={s.hero}>{usd(c.totalCost)}</Text>
          <Dim>
            {c.subtitle} · {c.miles.toLocaleString()} miles over {c.days} day
            {c.days === 1 ? '' : 's'}
            {isSubset
              ? ` · ${report.shareOfFleetCost.toFixed(1)}% of the fleet's ${usd(report.fleetTotalCost)}`
              : ''}
          </Dim>

          <TileRow>
            <StatTile label="Per day" value={usd(c.costPerDay)} />
            <StatTile label="Per mile" value={usdCents(c.costPerMile)} />
            <StatTile label="Fixed/day" value={usd(c.fixedCostPerDay)} sub="standing cost" />
          </TileRow>
          <TileRow>
            <StatTile label="Revenue" value={usd(c.revenue)} color={colors.green} />
            <StatTile
              label="Net"
              value={usd(c.netProfit)}
              color={c.netProfit >= 0 ? colors.profit : colors.loss}
            />
            <StatTile
              label="Op ratio"
              value={`${c.operatingRatio.toFixed(1)}%`}
              sub={c.operatingRatio >= 100 ? 'losing' : c.operatingRatio >= 95 ? 'thin' : 'healthy'}
              color={
                c.operatingRatio >= 100 ? colors.red
                : c.operatingRatio >= 95 ? colors.amber
                : colors.green
              }
            />
          </TileRow>

          {c.incidentCost > 0 ? (
            <View style={s.incidentBanner}>
              <Text style={s.incidentText}>
                {c.incidentCount} unplanned event{c.incidentCount === 1 ? '' : 's'} added{' '}
                {usd(c.incidentCost)} — {((c.incidentCost / c.totalCost) * 100).toFixed(1)}% of total
                cost.
              </Text>
            </View>
          ) : null}
        </Card>
      </Section>

      {/* --- Where the money goes ------------------------------------------- */}
      <Section title="Where the money goes" subtitle={`${PERIOD_LABELS[period]} · ${c.subtitle}`}>
        <Card>
          {c.buckets
            .filter((b) => b.amount > 0)
            .map((b) => (
              <View key={b.label} style={s.bucket}>
                <View style={s.bucketHead}>
                  <Text style={s.bucketLabel}>{b.label}</Text>
                  <Text style={s.bucketValue}>{usd(b.amount)}</Text>
                </View>
                <Bar
                  fraction={b.amount / Math.max(...c.buckets.map((x) => x.amount), 1)}
                  color={categoryColor[b.category] ?? colors.textDim}
                />
                <Text style={s.bucketSub}>
                  {usdCents(b.perMile)}/mi · {usd(b.perDay)}/day
                </Text>
              </View>
            ))}
          <View style={s.hr} />
          <Row label="Total" value={usd(c.totalCost)} bold />
        </Card>
      </Section>

      {/* --- Per truck / per driver ------------------------------------------ */}
      <Section
        title="Breakdown"
        subtitle={view === 'truck' ? 'Ranked by cost per mile' : 'Truck cost attributed to its driver'}
      >
        <Segmented
          options={[
            { value: 'truck', label: 'By truck' },
            { value: 'driver', label: 'By driver' },
          ]}
          value={view}
          onChange={setView}
          small
        />

        {view === 'truck'
          ? report.perTruck
              .slice()
              .sort((a, b) => b.costPerMile - a.costPerMile)
              .map((t) => <TruckCard key={t.truckId} summary={t} />)
          : report.perDriver.length === 0
            ? <Empty title="No drivers" body="Add drivers on the Drivers tab and assign them to a unit." />
            : report.perDriver
                .slice()
                .sort((a, b) => b.totalCost - a.totalCost)
                .map((d) => <DriverCard key={d.driverId} summary={d} />)}
      </Section>

      {/* --- Insights ------------------------------------------------------- */}
      <Section title="Read on the numbers">
        <Card>
          {report.insights.map((line, i) => (
            <View key={i} style={s.insight}>
              <Text style={s.bullet}>▸</Text>
              <Body style={{ flex: 1 }}>{line}</Body>
            </View>
          ))}
        </Card>
      </Section>

      <Card>
        <Label>How these numbers are built</Label>
        <Dim>
          Fixed costs accrue on calendar days — the truck payment does not pause when the truck sits.
          Variable costs accrue on miles. Unplanned costs are not modeled at all: they are whatever
          you actually recorded in the ledger. Where a truck has no recorded miles or revenue for the
          period, its planned utilization and target rate are used instead, so a new fleet still gets
          a usable projection.
        </Dim>
      </Card>
    </Screen>
  );
}

function TruckCard({ summary: t }: { summary: TruckCostSummary }) {
  const losing = t.revenue > 0 && t.netProfit < 0;
  return (
    <Card accent={losing ? colors.red : t.active ? colors.green : colors.textFaint}>
      <View style={s.truckHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.truckTitle}>{t.title}</Text>
          <Dim>{t.subtitle}</Dim>
        </View>
        {!t.active ? <Pill text="INACTIVE" color={colors.textFaint} /> : null}
        {losing ? <Pill text="LOSING" color={colors.red} bg={colors.redDim} /> : null}
      </View>

      <TileRow>
        <StatTile label="Cost" value={usd(t.totalCost)} />
        <StatTile label="Per mile" value={usdCents(t.costPerMile)} />
        <StatTile
          label="Net"
          value={usd(t.netProfit)}
          color={t.netProfit >= 0 ? colors.profit : colors.loss}
        />
      </TileRow>

      <Row label="Miles" value={t.miles.toLocaleString()} />
      <Row label="Revenue" value={usd(t.revenue)} valueColor={colors.green} />
      <Row
        label="Operating ratio"
        value={`${t.operatingRatio.toFixed(1)}%`}
        valueColor={
          t.operatingRatio >= 100 ? colors.red : t.operatingRatio >= 95 ? colors.amber : colors.green
        }
      />
      <Row label="Fixed / day" value={usd(t.fixedCostPerDay)} sub="Accrues whether it rolls or not" />
      {t.incidentCost > 0 ? (
        <Row
          label={`Unplanned (${t.incidentCount})`}
          value={usd(t.incidentCost)}
          valueColor={colors.red}
        />
      ) : null}
      <Row label="Break-even" value={`${usdCents(t.breakEvenRatePerMile)}/mi`} bold />
    </Card>
  );
}

function DriverCard({ summary: d }: { summary: DriverCostSummary }) {
  const unassigned = !d.truckId;
  const losing = d.revenue > 0 && d.netProfit < 0;
  return (
    <Card
      accent={
        unassigned ? colors.textFaint
        : losing ? colors.red
        : d.status === 'active' ? colors.green
        : colors.amber
      }
    >
      <View style={s.truckHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.truckTitle}>{d.name}</Text>
          <Dim>{d.truckLabel}</Dim>
        </View>
        {d.status !== 'active' ? (
          <Pill text={d.status.replace('-', ' ').toUpperCase()} color={colors.amber} />
        ) : null}
        {unassigned ? <Pill text="UNASSIGNED" color={colors.textFaint} /> : null}
      </View>

      {unassigned ? (
        <Dim>
          Not seated in a unit, so no operating cost is attributed. Assign a truck on the Drivers
          tab.
        </Dim>
      ) : (
        <>
          <TileRow>
            <StatTile label="Cost" value={usd(d.totalCost)} />
            <StatTile label="Per mile" value={usdCents(d.costPerMile)} />
            <StatTile
              label="Net"
              value={usd(d.netProfit)}
              color={d.netProfit >= 0 ? colors.profit : colors.loss}
            />
          </TileRow>
          <Row label="Miles" value={d.miles.toLocaleString()} />
          <Row label="Revenue" value={usd(d.revenue)} valueColor={colors.green} />
          <Row
            label="Operating ratio"
            value={`${d.operatingRatio.toFixed(1)}%`}
            valueColor={
              d.operatingRatio >= 100 ? colors.red
              : d.operatingRatio >= 95 ? colors.amber
              : colors.green
            }
          />
          {d.incidentCost > 0 ? (
            <Row
              label={`Unplanned (${d.incidentCount})`}
              value={usd(d.incidentCost)}
              valueColor={colors.red}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  company: { ...type.h1, color: colors.text },
  alertName: { ...type.h3, color: colors.text },
  hero: { fontSize: 40, fontWeight: '900', color: colors.text, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
  clearBtn: { minHeight: 36, paddingHorizontal: space.md },

  chipCost: { ...type.h3, color: colors.text, fontVariant: ['tabular-nums'] },
  chipCpm: { ...type.tiny, color: colors.textFaint },

  incidentBanner: {
    backgroundColor: colors.redDim,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.sm,
  },
  incidentText: { ...type.small, color: colors.red, lineHeight: 18 },

  bucket: { paddingVertical: space.sm, gap: 6 },
  bucketHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  bucketLabel: { ...type.body, color: colors.text, flex: 1, fontWeight: '600' },
  bucketValue: { ...type.body, color: colors.text, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bucketSub: { ...type.small, color: colors.textFaint },

  truckHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  truckTitle: { ...type.h2, color: colors.text },

  insight: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm },
  bullet: { color: colors.accent, fontWeight: '900', fontSize: 14, marginTop: 3 },
});
