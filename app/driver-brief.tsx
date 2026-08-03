import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { buildDriverBrief, driverBriefToText } from '../src/calc/driverBrief';
import { isRtl, LANGUAGES, type Lang } from '../src/data/i18n';
import { useActiveTruck, useStore } from '../src/store/store';
import { useTrip } from '../src/store/trip';
import type { WeatherSeverity } from '../src/types';
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
  StatTile,
  Pill,
  TileRow,
} from '../src/ui/components';
import {
  colors,
  hours,
  miles as fmtMiles,
  radius,
  shortDateTime,
  space,
  statusBg,
  statusColor,
  type,
  usdCents,
} from '../src/ui/theme';

const SEVERITY_COLOR: Record<WeatherSeverity, string> = {
  clear: colors.green,
  caution: colors.blue,
  advisory: colors.amber,
  severe: colors.red,
};

/**
 * The driver's brief, and the button that sends it.
 *
 * Dispatch sees this before sharing, so what they send is exactly what they
 * reviewed. There is no rate, cost, or margin anywhere on this screen — not
 * because they are hidden, but because `buildDriverBrief` never puts them in
 * the object. Fuel prices per gallon are here on purpose: a driver told to
 * fill in Texas needs to know why.
 */
export default function DriverBriefScreen() {
  const { brief } = useTrip();
  const { fleet } = useStore();
  const truck = useActiveTruck();
  const [notes, setNotes] = useState('');
  const [lang, setLang] = useState<Lang>('en');

  const driverBrief = useMemo(
    () =>
      brief
        ? buildDriverBrief(brief, {
            fleet,
            truck,
            drivers: fleet.drivers,
            dispatchNotes: notes,
          })
        : null,
    [brief, fleet, truck, notes],
  );

  if (!brief || !driverBrief) {
    return (
      <Screen>
        <Empty
          title="No brief yet"
          body="Plan a trip and generate a brief first — the driver's copy is built from it."
        />
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const b = driverBrief;
  const level = b.riskLevel;

  const send = async () => {
    try {
      await Share.share({
        title: `Driver brief — ${b.origin} to ${b.destination}`,
        message: driverBriefToText(b, lang),
      });
    } catch {
      // The user dismissed the share sheet. Nothing to recover.
    }
  };

  return (
    <Screen>
      {/* --- Status ---------------------------------------------------------- */}
      <View style={[s.bluf, { backgroundColor: statusBg(level), borderColor: statusColor(level) }]}>
        <View style={s.blufHead}>
          <Text style={[s.blufLevel, { color: statusColor(level) }]}>{level}</Text>
          <Text style={s.blufScore}>RISK {b.riskScore}/100</Text>
        </View>
        <Text style={s.blufLine}>{b.bottomLine}</Text>
      </View>

      <Card>
        <Label>Driver copy</Label>
        <Text style={s.route}>
          {b.origin} → {b.destination}
        </Text>
        <Dim>
          {b.carrier}
          {b.unitNumber ? ` · Unit ${b.unitNumber}` : ''}
          {b.driverNames.length ? ` · ${b.driverNames.join(' / ')}` : ''}
        </Dim>
        <View style={s.noMoney}>
          <Text style={s.noMoneyText}>
            No rates, costs or margins are in this copy. Safe to send to the driver.
          </Text>
        </View>
      </Card>

      {/* --- Language ---------------------------------------------------------- */}
      <Section title="Send it in" subtitle="The driver's copy is translated — this screen stays in English">
        <View style={s.langRow}>
          {LANGUAGES.map((l) => {
            const on = l.code === lang;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLang(l.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[s.lang, on && s.langOn]}
              >
                <Text style={[s.langNative, on && { color: colors.text }]}>{l.native}</Text>
                <Text style={s.langLabel}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {lang !== 'en' ? (
          <Card>
            <Label>Preview of what they receive</Label>
            <Text style={[s.preview, isRtl(lang) && s.previewRtl]}>
              {driverBriefToText(b, lang).split('\n').slice(0, 14).join('\n')}
              {'\n…'}
            </Text>
            <Dim>
              Place names, unit numbers, road numbers like I-80 and weather-service wording stay in
              English on purpose — the driver has to match those against road signs and paperwork.
            </Dim>
          </Card>
        ) : null}
      </Section>

      {/* --- Dispatch notes --------------------------------------------------- */}
      <Section title="Note from dispatch" subtitle="Optional — appears at the top of what they receive">
        <Card>
          <Field
            label="Message"
            value={notes}
            onChangeText={setNotes}
            placeholder="Gate code, dock hours, who to call on arrival…"
          />
        </Card>
      </Section>

      {/* --- The run ---------------------------------------------------------- */}
      <Section title="The run">
        <Card>
          <TileRow>
            <StatTile label="Distance" value={fmtMiles(b.totalMiles)} sub={b.deadheadMiles ? `${b.deadheadMiles} deadhead` : undefined} />
            <StatTile label="Drive time" value={hours(b.drivingHours)} />
            <StatTile label="Out" value={`${b.nightsOut}n`} sub={`${b.tripDays} days`} />
          </TileRow>
          <View style={s.hr} />
          <Row label="States" value={b.states.join(' · ')} />
          <Row label="Depart" value={shortDateTime(b.departAt)} />
          <Row label="ETA" value={shortDateTime(b.eta)} bold />
          {b.deliverBy ? (
            <Row
              label="Appointment"
              value={shortDateTime(b.deliverBy)}
              sub={
                b.legalOnTime
                  ? `${(b.slackHours ?? 0).toFixed(1)} hr of slack`
                  : `LATE by ${Math.abs(b.slackHours ?? 0).toFixed(1)} hr — do not run illegal`
              }
              valueColor={b.legalOnTime ? colors.text : colors.red}
            />
          ) : null}
          <Row
            label="Equipment"
            value={b.equipment + (b.reeferSetPointF !== null ? ` @ ${b.reeferSetPointF}°F` : '')}
          />
          <Row label="Gross weight" value={`${b.grossWeightLbs.toLocaleString()} lb`} />
          {b.hazmat ? <Row label="Hazmat" value={b.hazmat} valueColor={colors.amber} /> : null}
          {b.oversize ? <Row label="Oversize" value="Permits + escort" valueColor={colors.amber} /> : null}
        </Card>
      </Section>

      {/* --- Fuel -------------------------------------------------------------- */}
      <Section title="Fuel plan" subtitle="Where to fill and why">
        <Card accent={colors.accent}>
          {b.fuel.advice.map((a, i) => (
            <View key={i} style={s.advice}>
              <Text style={s.bullet}>▸</Text>
              <Body style={{ flex: 1 }}>{a}</Body>
            </View>
          ))}
          <View style={s.hr} />
          <Row
            label="Range on a full tank"
            value={fmtMiles(b.fuel.rangeMiles)}
            sub={`${b.fuel.tankGallons} gal @ ${b.fuel.mpg} mpg`}
          />
        </Card>

        <Card>
          <Label>Diesel by state</Label>
          {b.fuel.byState.map((f) => (
            <Row
              key={f.state}
              label={`${f.state} — ${f.stateName}`}
              value={usdCents(f.pricePerGal)}
              sub={
                f.cheapest ? `${f.miles} mi · cheapest on route`
                : f.avoid ? `${f.miles} mi · most expensive, buy minimum`
                : `${f.miles} mi`
              }
              valueColor={f.cheapest ? colors.green : f.avoid ? colors.red : undefined}
            />
          ))}
        </Card>

        {b.fuel.plannedStops.length > 0 ? (
          <Card>
            <Label>Planned fuel stops</Label>
            {b.fuel.plannedStops.map((st, i) => (
              <Row key={i} label={`Mile ${st.atMile.toLocaleString()}`} value={shortDateTime(st.at)} />
            ))}
          </Card>
        ) : null}
      </Section>

      {/* --- Timeline ---------------------------------------------------------- */}
      <Section title="Timeline" subtitle="Required breaks and resets are not optional">
        <Card>
          {b.schedule.map((stop, i) => (
            <View key={i} style={s.timelineRow}>
              <View
                style={[
                  s.dot,
                  {
                    backgroundColor:
                      stop.kind === '10-hr-reset' ? colors.blue
                      : stop.kind === '30-min-break' ? colors.amber
                      : stop.kind === 'fuel' ? colors.accent
                      : colors.green,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
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
          {b.cycleWarnings.map((w, i) => (
            <View key={i} style={s.warn}>
              <Text style={s.warnText}>{w}</Text>
            </View>
          ))}
        </Card>
      </Section>

      {/* --- Hazards ----------------------------------------------------------- */}
      <Section title="What the road will do">
        <Card>
          <Label>Weather along route</Label>
          {b.weather.map((p, i) => (
            <View key={i} style={s.wxRow}>
              <View style={[s.wxDot, { backgroundColor: SEVERITY_COLOR[p.severity] }]} />
              <View style={{ flex: 1 }}>
                <View style={s.wxHead}>
                  <Text style={s.wxState}>{p.state}</Text>
                  <Text style={s.wxMile}>mile {p.atMile.toLocaleString()}</Text>
                  <Pill text={p.severity.toUpperCase()} color={SEVERITY_COLOR[p.severity]} bg={colors.surfaceAlt} />
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

        {b.incidents.length > 0 ? (
          <Card>
            <Label>Traffic — {Math.round(b.totalDelayMinutes)} min projected</Label>
            {b.incidents.map((inc, i) => (
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

        {b.restrictions.length > 0 ? (
          <Card>
            <Label>Restrictions</Label>
            {b.restrictions.map((r, i) => (
              <Row
                key={i}
                label={r.title}
                value={r.blocking ? 'BLOCKING' : '—'}
                sub={r.detail}
                valueColor={r.blocking ? colors.red : undefined}
              />
            ))}
          </Card>
        ) : null}
      </Section>

      {/* --- Dispatch contact --------------------------------------------------- */}
      {b.dispatchPhone || b.dispatchName ? (
        <Card accent={colors.blue}>
          <Label>Call dispatch</Label>
          <Text style={s.dispatch}>{b.dispatchPhone || 'No number on file'}</Text>
          {b.dispatchName ? <Dim>{b.dispatchName}</Dim> : null}
        </Card>
      ) : null}

      {b.containsMockData ? (
        <Card accent={colors.amber}>
          <Body style={{ color: colors.amber }}>
            Parts of this brief use modeled data rather than live feeds. Verify weather and road
            conditions before rolling.
          </Body>
        </Card>
      ) : null}

      <Button title="Send to driver" onPress={send} />
      <Button
        title="Start en-route weather watch"
        variant="secondary"
        onPress={() => router.push('/enroute')}
      />
      <Button title="Back to full brief" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  bluf: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm },
  blufHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  blufLevel: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  blufScore: { ...type.tiny, color: colors.textDim, marginLeft: 'auto' },
  blufLine: { ...type.body, color: colors.text, lineHeight: 21, fontWeight: '600' },

  route: { ...type.h1, color: colors.text },
  noMoney: {
    backgroundColor: colors.greenDim,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.sm,
  },
  noMoneyText: { ...type.small, color: colors.green, lineHeight: 18 },

  hr: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },

  advice: { flexDirection: 'row', gap: space.sm, paddingVertical: 4 },
  bullet: { color: colors.accent, fontWeight: '900', fontSize: 14, marginTop: 3 },

  timelineRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  timelineKind: { ...type.tiny, color: colors.text, flex: 1 },
  timelineTime: { ...type.small, color: colors.textDim, fontVariant: ['tabular-nums'] },

  wxRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  wxDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  wxHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  wxState: { ...type.h3, color: colors.text },
  wxMile: { ...type.small, color: colors.textFaint, flex: 1 },
  alert: { ...type.small, color: colors.amber, marginTop: 4, lineHeight: 18 },

  warn: { backgroundColor: colors.amberDim, borderRadius: radius.sm, padding: space.md, marginTop: space.sm },
  warnText: { ...type.small, color: colors.amber, lineHeight: 18 },

  dispatch: { ...type.h1, color: colors.blue, fontVariant: ['tabular-nums'] },

  langRow: { flexDirection: 'row', gap: space.sm },
  lang: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  langOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  langNative: { ...type.h3, color: colors.textDim },
  langLabel: { ...type.tiny, color: colors.textFaint, marginTop: 2 },

  preview: {
    ...type.small,
    color: colors.text,
    fontFamily: 'monospace',
    lineHeight: 19,
    marginTop: space.xs,
  },
  previewRtl: { writingDirection: 'rtl', textAlign: 'right' },
});
