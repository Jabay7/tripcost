import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { newId, useStore } from '../src/store/store';
import { useTrip } from '../src/store/trip';
import type { CostLine, WeatherSeverity } from '../src/types';
import {
  Bar,
  Body,
  Button,
  Card,
  Dim,
  Empty,
  Label,
  Row,
  Screen,
  Section,
  StatTile,
  Pill,
  TileRow,
} from '../src/ui/components';
import {
  categoryColor,
  colors,
  hours,
  miles as fmtMiles,
  radius,
  shortDateTime,
  space,
  statusBg,
  statusColor,
  type,
  usd,
  usdCents,
} from '../src/ui/theme';

const SEVERITY_COLOR: Record<WeatherSeverity, string> = {
  clear: colors.green,
  caution: colors.blue,
  advisory: colors.amber,
  severe: colors.red,
};

export default function BriefScreen() {
  const { brief } = useTrip();
  const { addLedgerEntry, fleet, activeTruckId } = useStore();

  if (!brief) {
    return (
      <Screen>
        <Empty title="No brief yet" body="Plan a trip and generate a brief to see it here." />
        <Button title="Back to trip" onPress={() => router.back()} />
      </Screen>
    );
  }

  const { risk, cost, route, hos, fuel, weather, traffic, restrictions, input, profile } = brief;
  const level = risk.level;
  const profitable = cost.netProfit > 0;

  const truckId = activeTruckId ?? fleet.trucks[0]?.id;

  const logToLedger = () => {
    if (!truckId) return;
    const now = new Date().toISOString();
    addLedgerEntry({
      id: newId('led'),
      truckId,
      date: now,
      kind: 'revenue',
      category: 'linehaul',
      label: `${input.origin.name} → ${input.destination.name}`,
      amount: cost.committedRevenue,
      miles: Math.round(route.totalMiles),
      note: 'Logged from trip brief.',
    });
    for (const line of cost.lines) {
      addLedgerEntry({
        id: newId('led'),
        truckId,
        date: now,
        kind: 'expense',
        category: line.category === 'incident' ? 'other' : 'fuel',
        label: line.label,
        amount: line.amount,
        miles: 0,
        note: line.basis,
      });
    }
    router.push('/(tabs)/ledger');
  };

  const maxLine = Math.max(...cost.lines.map((l) => l.amount), 1);

  return (
    <Screen>
      {/* --- BLUF ----------------------------------------------------------- */}
      <View style={[s.bluf, { backgroundColor: statusBg(level), borderColor: statusColor(level) }]}>
        <View style={s.blufHead}>
          <Text style={[s.blufLevel, { color: statusColor(level) }]}>{level}</Text>
          <Text style={s.blufScore}>RISK {risk.score}/100</Text>
        </View>
        <Text style={s.blufLine}>{risk.bottomLine}</Text>
      </View>

      <Card>
        <Label>Bottom line</Label>
        <Text style={[s.hero, { color: profitable ? colors.profit : colors.loss }]}>
          {usd(cost.netProfit)}
        </Text>
        <Dim>
          {profitable
            ? `Net profit after every cost, ${cost.marginPercent.toFixed(1)}% margin. That is ${usd(cost.profitPerDay)}/day for the ${hours(hos.totalElapsedHours)} this load ties up.`
            : `This load loses money. You need at least ${usdCents(cost.breakEvenRatePerMile)}/loaded mile to break even; this one pays ${usdCents(cost.revenuePerMile)}.`}
        </Dim>

        <TileRow>
          <StatTile label="Revenue" value={usd(cost.committedRevenue)} sub="committed" />
          <StatTile label="Cost" value={usd(cost.totalCost)} sub="all-in" />
          <StatTile
            label="Per mile"
            value={usdCents(cost.allInRatePerMile)}
            sub="all-in w/ deadhead"
            color={cost.allInRatePerMile >= cost.breakEvenRatePerMile ? colors.green : colors.red}
          />
        </TileRow>
        <TileRow>
          <StatTile label="Break-even" value={usdCents(cost.breakEvenRatePerMile)} sub="per loaded mi" />
          <StatTile label="Cost/mile" value={usdCents(cost.costPerMile)} sub="total miles" />
          <StatTile
            label="Cash to float"
            value={usd(cost.cashToFloat)}
            sub="before settlement"
            color={colors.amber}
          />
        </TileRow>
      </Card>

      {/* --- Route ---------------------------------------------------------- */}
      <Section
        title="Route"
        subtitle={`${input.origin.name} → ${input.destination.name}`}
      >
        <Card>
          <TileRow>
            <StatTile label="Total" value={fmtMiles(route.totalMiles)} sub={`${Math.round(input.deadheadMiles)} deadhead`} />
            <StatTile label="Drive time" value={hours(hos.drivingHours)} sub={`@ ${profile.avgSpeedMph} mph`} />
            <StatTile label="Elapsed" value={hours(hos.totalElapsedHours)} sub={`${hos.nightsOut} night${hos.nightsOut === 1 ? '' : 's'} out`} />
          </TileRow>

          <View style={s.hr} />

          <Row label="States crossed" value={route.states.join(' · ')} />
          <Row label="ETA" value={shortDateTime(hos.eta)} bold />
          {input.deliverBy ? (
            <Row
              label="Appointment"
              value={shortDateTime(input.deliverBy)}
              sub={
                hos.legalOnTime
                  ? `${hos.slackHours.toFixed(1)} hr of slack`
                  : `LATE by ${Math.abs(hos.slackHours).toFixed(1)} hr — cannot run legally`
              }
              valueColor={hos.legalOnTime ? colors.text : colors.red}
            />
          ) : null}
          <Row label="Tolls" value={usd(route.tollEstimate)} />
          {!route.truckLegal ? (
            <View style={s.warn}>
              <Text style={s.warnText}>
                Distance is a straight-line estimate, not a truck-legal route. Verify bridge
                clearances and restricted roads before dispatch.
              </Text>
            </View>
          ) : null}
        </Card>
      </Section>

      {/* --- Fuel plan ------------------------------------------------------ */}
      <Section title="Fuel" subtitle={`Blended ${usdCents(fuel.blendedPricePerGal)}/gal · ${fuel.asOf}`}>
        <Card>
          <Row
            label="Cheapest on route"
            value={`${fuel.cheapestState} @ ${usdCents(fuel.cheapestPrice)}`}
            sub="Fill here — a 200-gallon fill at this price versus the most expensive state on the route is real money."
            valueColor={colors.green}
          />
          <View style={s.hr} />
          {fuel.byState
            .slice()
            .sort((a, b) => a.pricePerGal - b.pricePerGal)
            .map((q) => (
              <Row
                key={q.state}
                label={q.state}
                value={usdCents(q.pricePerGal)}
                sub={`${Math.round(q.miles)} mi`}
                valueColor={
                  q.pricePerGal === fuel.cheapestPrice ? colors.green
                  : q.pricePerGal > fuel.nationalAvg + 0.35 ? colors.red
                  : undefined
                }
              />
            ))}
        </Card>
      </Section>

      {/* --- Timeline ------------------------------------------------------- */}
      <Section title="Timeline" subtitle="Hours of service — 11/14/30-min/10-hr modeled">
        <Card>
          {hos.stops.map((stop, i) => (
            <View key={i} style={s.timelineRow}>
              <View style={s.timelineDotCol}>
                <View
                  style={[
                    s.timelineDot,
                    {
                      backgroundColor:
                        stop.kind === '10-hr-reset' ? colors.blue
                        : stop.kind === '30-min-break' ? colors.amber
                        : stop.kind === 'fuel' ? colors.accent
                        : colors.green,
                    },
                  ]}
                />
                {i < hos.stops.length - 1 ? <View style={s.timelineLine} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: space.md }}>
                <View style={s.timelineHead}>
                  <Text style={s.timelineKind}>{stop.kind.replace(/-/g, ' ').toUpperCase()}</Text>
                  <Text style={s.timelineTime}>{shortDateTime(stop.at)}</Text>
                </View>
                <Dim>
                  Mile {stop.atMile.toLocaleString()} · {hours(stop.durationHours)}
                </Dim>
                <Dim style={{ marginTop: 2 }}>{stop.note}</Dim>
              </View>
            </View>
          ))}
          {hos.cycleWarnings.map((w, i) => (
            <View key={i} style={s.warn}>
              <Text style={s.warnText}>{w}</Text>
            </View>
          ))}
        </Card>
      </Section>

      {/* --- Hazards -------------------------------------------------------- */}
      <Section title="Hazards" subtitle={`Weather · traffic · restrictions`}>
        <Card>
          <Label>Weather along route</Label>
          {weather.points.map((p, i) => (
            <View key={i} style={s.wxRow}>
              <View style={[s.wxDot, { backgroundColor: SEVERITY_COLOR[p.severity] }]} />
              <View style={{ flex: 1 }}>
                <View style={s.wxHead}>
                  <Text style={s.wxState}>{p.state}</Text>
                  <Text style={s.wxMile}>mile {p.atMile.toLocaleString()}</Text>
                  <Pill
                    text={p.severity.toUpperCase()}
                    color={SEVERITY_COLOR[p.severity]}
                    bg={colors.surfaceAlt}
                  />
                </View>
                <Dim>{p.summary}</Dim>
                {p.alerts.map((a, j) => (
                  <Text key={j} style={s.alert}>
                    ⚠ {a}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </Card>

        {traffic.incidents.length > 0 ? (
          <Card>
            <Label>Traffic — {Math.round(traffic.totalDelayMinutes)} min projected delay</Label>
            {traffic.incidents.map((inc, i) => (
              <Row
                key={i}
                label={`${inc.state} · ${inc.route}`}
                value={`+${inc.delayMinutes}m`}
                sub={inc.description}
                valueColor={inc.severity === 'high' ? colors.red : inc.severity === 'medium' ? colors.amber : undefined}
              />
            ))}
          </Card>
        ) : null}

        {restrictions.restrictions.length > 0 ? (
          <Card>
            <Label>Restrictions & compliance</Label>
            {restrictions.restrictions.map((r, i) => (
              <Row
                key={i}
                label={r.title}
                value={r.blocking ? 'BLOCKING' : r.costUsd > 0 ? usd(r.costUsd) : '—'}
                sub={r.detail}
                valueColor={r.blocking ? colors.red : undefined}
              />
            ))}
          </Card>
        ) : null}
      </Section>

      {/* --- Risk factors --------------------------------------------------- */}
      {risk.factors.length > 0 ? (
        <Section title="Risk factors" subtitle={`${risk.score}/100 — ${level}`}>
          <Card>
            {risk.factors.map((f, i) => (
              <Row
                key={i}
                label={f.label}
                value={`+${Math.round(f.weight)}`}
                sub={f.detail}
                valueColor={
                  f.severity === 'high' ? colors.red : f.severity === 'medium' ? colors.amber : colors.textDim
                }
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {/* --- Costs ---------------------------------------------------------- */}
      <Section title="Cost breakdown" subtitle={`${usd(cost.totalCost)} total · ${usdCents(cost.costPerMile)}/mi`}>
        <Card>
          <TileRow>
            <StatTile label="Fixed" value={usd(cost.fixedTotal)} sub="happens anyway" />
            <StatTile
              label="You added"
              value={usd(cost.optionalTotal)}
              sub="this load"
              color={cost.optionalTotal > 0 ? colors.accent : undefined}
            />
            <StatTile
              label="Unplanned"
              value={usd(cost.incidentTotal)}
              sub="already spent"
              color={cost.incidentTotal > 0 ? colors.red : undefined}
            />
          </TileRow>
        </Card>

        <CostGroupCard
          title="Fixed — happens whether you like it or not"
          lines={cost.lines.filter((l) => l.group === 'fixed')}
          maxLine={maxLine}
        />
        <CostGroupCard
          title="Optional — you selected these for this load"
          lines={cost.lines.filter((l) => l.group === 'optional')}
          maxLine={maxLine}
          empty="Nothing added. No pilot car, no lumper, no permits on this run."
          accent={colors.accent}
        />
        <CostGroupCard
          title="Unplanned — already went wrong"
          lines={cost.lines.filter((l) => l.group === 'incident')}
          maxLine={maxLine}
          accent={colors.red}
        />

        <Card>
          <Row label="Total cost" value={usd(cost.totalCost)} bold valueColor={colors.text} />
        </Card>
      </Section>

      {/* --- Revenue -------------------------------------------------------- */}
      <Section title="Revenue">
        <Card>
          {cost.revenue.map((r) => (
            <Row
              key={r.key}
              label={r.label + (r.contingent ? ' (if collected)' : '')}
              value={usd(r.amount)}
              sub={r.basis}
              valueColor={r.contingent ? colors.textDim : colors.green}
            />
          ))}
          <View style={s.hr} />
          <Row label="Committed" value={usd(cost.committedRevenue)} bold valueColor={colors.green} />
          <Row
            label="Best case with accessorials"
            value={usd(cost.potentialRevenue)}
            valueColor={colors.textDim}
          />
        </Card>
      </Section>

      {/* --- Cash --------------------------------------------------------- */}
      <Section title="Cash to float" subtitle="Money out of your pocket before you get paid">
        <Card accent={colors.amber}>
          <Text style={[s.hero, { color: colors.amber }]}>{usd(cost.cashToFloat)}</Text>
          <Dim>
            Fuel, tolls, lumpers, parking and meals come out of your pocket now. Settlement lands in
            15 to 45 days unless you factor. This is the number that decides whether you can take the
            load, not the profit.
          </Dim>
          <View style={s.hr} />
          {cost.lines
            .filter((l) => l.outOfPocket)
            .sort((a, b) => b.amount - a.amount)
            .map((l) => (
              <Row
                key={l.key}
                label={l.label}
                value={usd(l.amount)}
                sub={l.reimbursable ? 'Reimbursable — keep the receipt' : undefined}
              />
            ))}
        </Card>
      </Section>

      {/* --- Actions -------------------------------------------------------- */}
      <Button title="Log this trip to the ledger" onPress={logToLedger} />
      <Button title="Back to trip" variant="ghost" onPress={() => router.back()} />

      {/* --- Provenance ----------------------------------------------------- */}
      <Section title="Data sources">
        <Card>
          {brief.sources.map((src) => (
            <Row
              key={src.service}
              label={src.service}
              value={src.live ? 'LIVE' : 'OFFLINE'}
              sub={src.provider}
              valueColor={src.live ? colors.green : colors.amber}
            />
          ))}
          {brief.containsMockData ? (
            <View style={s.warn}>
              <Text style={s.warnText}>
                This brief contains modeled data, not live feeds. Numbers are directionally right but
                must not be treated as dispatch-grade until the live providers are connected.
              </Text>
            </View>
          ) : null}
          <Dim style={{ marginTop: space.sm }}>Generated {shortDateTime(brief.generatedAt)}</Dim>
        </Card>
      </Section>
    </Screen>
  );
}

/**
 * One block of the cost breakdown. Splitting fixed from optional is the point:
 * a driver looking at a thin load needs to see instantly which costs they could
 * have avoided and which were never up for negotiation.
 */
function CostGroupCard({
  title,
  lines,
  maxLine,
  empty,
  accent,
}: {
  title: string;
  lines: CostLine[];
  maxLine: number;
  empty?: string;
  accent?: string;
}) {
  if (lines.length === 0 && !empty) return null;

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <Card accent={accent}>
      <View style={s.groupHead}>
        <Text style={s.groupTitle}>{title}</Text>
        <Text style={s.groupTotal}>{usd(subtotal)}</Text>
      </View>

      {lines.length === 0 ? (
        <Dim>{empty}</Dim>
      ) : (
        lines
          .slice()
          .sort((a, b) => b.amount - a.amount)
          .map((line) => (
            <View key={line.key} style={s.costLine}>
              <View style={s.costLineHead}>
                <Text style={s.costLabel}>{line.label}</Text>
                <Text style={s.costValue}>{usd(line.amount)}</Text>
              </View>
              <Bar
                fraction={line.amount / maxLine}
                color={categoryColor[line.category] ?? colors.textDim}
              />
              <Text style={s.costBasis}>{line.basis}</Text>
              {line.outOfPocket || line.reimbursable ? (
                <View style={s.tagRow}>
                  {line.outOfPocket ? <Pill text="OUT OF POCKET" color={colors.amber} /> : null}
                  {line.reimbursable ? <Pill text="REIMBURSABLE" color={colors.green} /> : null}
                </View>
              ) : null}
            </View>
          ))
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  bluf: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  groupTitle: { ...type.h3, color: colors.text, flex: 1, lineHeight: 20 },
  groupTotal: { ...type.h3, color: colors.text, fontVariant: ['tabular-nums'] },
  blufHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  blufLevel: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  blufScore: { ...type.tiny, color: colors.textDim, marginLeft: 'auto' },
  blufLine: { ...type.body, color: colors.text, lineHeight: 21, fontWeight: '600' },

  hero: { fontSize: 40, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },

  warn: {
    backgroundColor: colors.amberDim,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.sm,
  },
  warnText: { ...type.small, color: colors.amber, lineHeight: 18 },

  timelineRow: { flexDirection: 'row', gap: space.md },
  timelineDotCol: { alignItems: 'center', width: 14 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  timelineHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  timelineKind: { ...type.tiny, color: colors.text, flex: 1 },
  timelineTime: { ...type.small, color: colors.textDim, fontVariant: ['tabular-nums'] },

  wxRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  wxDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  wxHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  wxState: { ...type.h3, color: colors.text },
  wxMile: { ...type.small, color: colors.textFaint, flex: 1 },
  alert: { ...type.small, color: colors.amber, marginTop: 4, lineHeight: 18 },

  costLine: { paddingVertical: space.sm, gap: 6 },
  costLineHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  costLabel: { ...type.body, color: colors.text, flex: 1, fontWeight: '600' },
  costValue: { ...type.body, color: colors.text, fontWeight: '800', fontVariant: ['tabular-nums'] },
  costBasis: { ...type.small, color: colors.textFaint, lineHeight: 17 },
  tagRow: { flexDirection: 'row', gap: space.xs, marginTop: 2 },
});
