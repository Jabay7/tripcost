import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haversineMiles } from '../../src/data/geo';
import { CATEGORY_LABELS } from '../../src/data/incidents';
import {
  modeSuffix,
  OPTIONAL_COSTS,
  resolveOptionalAmount,
} from '../../src/data/optionalCosts';
import { useActiveTruck, useStore } from '../../src/store/store';
import { useTrip } from '../../src/store/trip';
import type { EquipmentType, HazmatClass } from '../../src/types';
import { Body, Button, Card, Dim, Empty, Field } from '../../src/ui/components';
import { PlacePicker } from '../../src/ui/PlacePicker';
import { colors, radius, space, type, usd, usdCents } from '../../src/ui/theme';

/**
 * Trip entry as a short interview rather than a form.
 *
 * The people using this are standing at a dock or sitting in a running truck.
 * So: four screens, one question each, tap targets sized for gloves, and a
 * sensible default behind every field so the whole thing can be skipped. Typing
 * is reserved for the two numbers that genuinely vary — the rate and the
 * amounts on any extras.
 *
 * The last step is the one that matters most for accuracy. Fuel, tolls, tires
 * and the truck payment are calculated whether the driver likes it or not. A
 * pilot car or a lumper only exists if this load needs it, so those are asked
 * rather than assumed.
 */

const STEPS = ['Route', 'Load', 'Pay', 'Extras'] as const;

const EQUIPMENT: { value: EquipmentType; label: string; icon: string }[] = [
  { value: 'dry-van', label: 'Dry Van', icon: '🚛' },
  { value: 'reefer', label: 'Reefer', icon: '❄️' },
  { value: 'flatbed', label: 'Flatbed', icon: '🪵' },
  { value: 'tanker', label: 'Tanker', icon: '🛢️' },
];

const WEIGHTS = [
  { label: 'Empty', value: 32000 },
  { label: 'Light', value: 45000 },
  { label: 'Loaded', value: 62000 },
  { label: 'Heavy', value: 76000 },
  { label: 'Maxed', value: 80000 },
];

const DEADHEADS = [0, 25, 50, 100, 200];

const HAZMAT_CHOICES: { value: HazmatClass | 'none'; label: string }[] = [
  { value: 'none', label: 'No hazmat' },
  { value: '3-flammable-liquid', label: 'Class 3 Flammable' },
  { value: '8-corrosive', label: 'Class 8 Corrosive' },
  { value: '2-gases', label: 'Class 2 Gases' },
];

const HOUR = 3_600_000;

export default function PlanTripScreen() {
  const { fleet, activeTruckId, setActiveTruck } = useStore();
  const truck = useActiveTruck();
  const {
    trip,
    patchTrip,
    toggleOptional,
    setOptionalAmount,
    addedCosts,
    removeCost,
    generate,
    building,
    error,
  } = useTrip();

  const [step, setStep] = useState(0);

  // Rough numbers so the Extras step can price per-mile and per-night items
  // before the real route exists.
  const estimate = useMemo(() => {
    const miles = haversineMiles(trip.origin, trip.destination) * 1.18 + trip.deadheadMiles;
    return {
      totalMiles: miles,
      nights: Math.max(0, Math.floor(miles / 550)),
      states: Math.max(1, Math.round(miles / 320)),
    };
  }, [trip.origin, trip.destination, trip.deadheadMiles]);

  const suggested = useMemo(
    () => new Set(OPTIONAL_COSTS.filter((o) => o.suggest(trip)).map((o) => o.key)),
    [trip],
  );

  const extrasTotal = useMemo(() => {
    let sum = 0;
    for (const sel of trip.optionalCosts) {
      if (!sel.enabled) continue;
      const def = OPTIONAL_COSTS.find((o) => o.key === sel.key);
      if (!def) continue;
      sum += resolveOptionalAmount(def, sel.amount, estimate).total;
    }
    return sum;
  }, [trip.optionalCosts, estimate]);

  const selectedCount = trip.optionalCosts.filter((o) => o.enabled).length;

  if (!truck) {
    return (
      <View style={s.root}>
        <Empty
          title="No trucks yet"
          body="Add a truck first — the cost basis comes from the truck."
        />
        <View style={s.footer}>
          <Button title="Go to Trucks" onPress={() => router.push('/(tabs)/trucks')} />
        </View>
      </View>
    );
  }

  const onGenerate = async () => {
    const b = await generate(truck.profile);
    if (b) router.push('/brief');
  };

  const setDepart = (ms: number) => patchTrip({ departAt: new Date(ms).toISOString() });
  const nextHour = () => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d.getTime() + HOUR;
  };
  const tomorrowAt = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };

  const departLabel = new Date(trip.departAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const isLast = step === STEPS.length - 1;

  return (
    <View style={s.root}>
      {/* --- Progress --------------------------------------------------------- */}
      <View style={s.progressWrap}>
        <View style={s.progressBar}>
          {STEPS.map((label, i) => (
            <Pressable
              key={label}
              onPress={() => setStep(i)}
              accessibilityRole="button"
              accessibilityLabel={`Step ${i + 1}, ${label}`}
              style={s.progressSeg}
            >
              <View style={[s.progressTrack, i <= step && s.progressTrackOn]} />
              <Text style={[s.progressLabel, i === step && s.progressLabelOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* --- Step 1: Route -------------------------------------------------- */}
        {step === 0 ? (
          <>
            <Text style={s.question}>Where are you running?</Text>

            {fleet.trucks.length > 1 ? (
              <View style={s.block}>
                <Text style={s.blockLabel}>TRUCK</Text>
                <View style={s.chipWrap}>
                  {fleet.trucks.map((t) => {
                    const on = t.id === (activeTruckId ?? fleet.trucks[0]?.id);
                    return (
                      <Tap
                        key={t.id}
                        on={on}
                        onPress={() => setActiveTruck(t.id)}
                        title={t.unitNumber}
                        sub={`${t.profile.mpg} mpg`}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={{ gap: space.sm }}>
              <PlacePicker
                label="From"
                value={trip.origin}
                onChange={(p) => patchTrip({ origin: p })}
                accent={colors.green}
              />
              <PlacePicker
                label="To"
                value={trip.destination}
                onChange={(p) => patchTrip({ destination: p })}
                accent={colors.red}
              />
            </View>

            <View style={s.block}>
              <Text style={s.blockLabel}>EMPTY MILES TO THE SHIPPER</Text>
              <View style={s.chipWrap}>
                {DEADHEADS.map((d) => (
                  <Tap
                    key={d}
                    on={trip.deadheadMiles === d}
                    onPress={() => patchTrip({ deadheadMiles: d })}
                    title={d === 0 ? 'None' : `${d} mi`}
                  />
                ))}
              </View>
              <Dim>Deadhead burns fuel and earns nothing. It belongs in the math.</Dim>
            </View>

            <Card>
              <Dim>
                About {Math.round(estimate.totalMiles).toLocaleString()} miles all in, roughly{' '}
                {estimate.nights === 0 ? 'a single shift' : `${estimate.nights} night${estimate.nights === 1 ? '' : 's'} out`}.
              </Dim>
            </Card>
          </>
        ) : null}

        {/* --- Step 2: Load --------------------------------------------------- */}
        {step === 1 ? (
          <>
            <Text style={s.question}>What are you hauling?</Text>

            <View style={s.block}>
              <Text style={s.blockLabel}>TRAILER</Text>
              <View style={s.grid}>
                {EQUIPMENT.map((e) => (
                  <Tap
                    key={e.value}
                    on={trip.equipment === e.value}
                    onPress={() =>
                      patchTrip({
                        equipment: e.value,
                        reeferSetPointF:
                          e.value === 'reefer' ? (trip.reeferSetPointF ?? 34) : null,
                      })
                    }
                    title={e.label}
                    icon={e.icon}
                    big
                  />
                ))}
              </View>
            </View>

            {trip.equipment === 'reefer' ? (
              <View style={s.block}>
                <Text style={s.blockLabel}>REEFER SET POINT</Text>
                <View style={s.chipWrap}>
                  {[-10, 0, 28, 34, 55].map((t) => (
                    <Tap
                      key={t}
                      on={trip.reeferSetPointF === t}
                      onPress={() => patchTrip({ reeferSetPointF: t })}
                      title={`${t}°F`}
                    />
                  ))}
                </View>
                <Dim>The unit burns fuel the whole trip, including while you sleep.</Dim>
              </View>
            ) : null}

            <View style={s.block}>
              <Text style={s.blockLabel}>WEIGHT</Text>
              <View style={s.chipWrap}>
                {WEIGHTS.map((w) => (
                  <Tap
                    key={w.value}
                    on={trip.grossWeightLbs === w.value}
                    onPress={() => patchTrip({ grossWeightLbs: w.value })}
                    title={w.label}
                    sub={`${(w.value / 1000).toFixed(0)}k`}
                  />
                ))}
              </View>
            </View>

            <View style={s.block}>
              <Text style={s.blockLabel}>HAZMAT</Text>
              <View style={s.chipWrap}>
                {HAZMAT_CHOICES.map((h) => (
                  <Tap
                    key={h.value}
                    on={(trip.hazmat ?? 'none') === h.value}
                    onPress={() =>
                      patchTrip({ hazmat: h.value === 'none' ? null : (h.value as HazmatClass) })
                    }
                    title={h.label}
                  />
                ))}
              </View>
            </View>

            <View style={s.block}>
              <Text style={s.blockLabel}>OVERSIZE</Text>
              <View style={s.chipWrap}>
                <Tap on={!trip.oversize} onPress={() => patchTrip({ oversize: false })} title="Legal" />
                <Tap
                  on={trip.oversize}
                  onPress={() => patchTrip({ oversize: true })}
                  title="Oversize"
                  sub="permits + escort"
                />
              </View>
            </View>
          </>
        ) : null}

        {/* --- Step 3: Pay and time ------------------------------------------- */}
        {step === 2 ? (
          <>
            <Text style={s.question}>What does it pay, and when do you roll?</Text>

            <View style={s.block}>
              <Text style={s.blockLabel}>RATE</Text>
              <View style={s.chipWrap}>
                <Tap
                  on={trip.rateMode === 'per-mile'}
                  onPress={() => patchTrip({ rateMode: 'per-mile', rate: 2.6 })}
                  title="Per mile"
                />
                <Tap
                  on={trip.rateMode === 'flat'}
                  onPress={() => patchTrip({ rateMode: 'flat', rate: 2200 })}
                  title="Flat rate"
                />
              </View>
              <Field
                label={trip.rateMode === 'flat' ? 'Total linehaul' : 'Linehaul per mile'}
                value={String(trip.rate)}
                onChangeText={(v) => patchTrip({ rate: num(v) })}
                keyboardType="decimal-pad"
                suffix={trip.rateMode === 'flat' ? '$' : '$/mi'}
                hint="Linehaul only. Fuel surcharge is figured separately."
              />
            </View>

            <View style={s.block}>
              <Text style={s.blockLabel}>DEPART</Text>
              <View style={s.chipWrap}>
                <Tap on={false} onPress={() => setDepart(Date.now())} title="Now" />
                <Tap on={false} onPress={() => setDepart(Date.now() + 2 * HOUR)} title="In 2 hr" />
                <Tap on={false} onPress={() => setDepart(nextHour())} title="Top of hour" />
                <Tap on={false} onPress={() => setDepart(tomorrowAt(6))} title="Tomorrow 6a" />
              </View>
              <Card>
                <Text style={s.departValue}>{departLabel}</Text>
              </Card>
            </View>

            <View style={s.block}>
              <Text style={s.blockLabel}>DELIVERY APPOINTMENT</Text>
              <View style={s.chipWrap}>
                <Tap
                  on={trip.deliverBy === null}
                  onPress={() => patchTrip({ deliverBy: null })}
                  title="No hard time"
                />
                {[24, 36, 48, 72].map((h) => {
                  const target = new Date(trip.departAt).getTime() + h * HOUR;
                  const on =
                    trip.deliverBy !== null &&
                    Math.abs(new Date(trip.deliverBy).getTime() - target) < HOUR / 2;
                  return (
                    <Tap
                      key={h}
                      on={on}
                      onPress={() => patchTrip({ deliverBy: new Date(target).toISOString() })}
                      title={`${h} hr`}
                    />
                  );
                })}
              </View>
              <Dim>
                Set one and the brief will tell you whether the load can be delivered legally on
                time.
              </Dim>
            </View>
          </>
        ) : null}

        {/* --- Step 4: Extras -------------------------------------------------- */}
        {step === 3 ? (
          <>
            <Text style={s.question}>Anything else on this load?</Text>
            <Dim style={{ marginTop: -space.sm }}>
              Fuel, tolls, tires and your truck payment are already counted. These are the ones only
              you know about. Tap what applies — nothing is charged unless you turn it on.
            </Dim>

            {[...OPTIONAL_COSTS]
              .sort((a, b) => {
                const as = suggested.has(a.key) ? 0 : 1;
                const bs = suggested.has(b.key) ? 0 : 1;
                return as - bs;
              })
              .map((def) => {
                const sel = trip.optionalCosts.find((o) => o.key === def.key);
                if (!sel) return null;
                const resolved = resolveOptionalAmount(def, sel.amount, estimate);
                const likely = suggested.has(def.key);

                return (
                  <Pressable
                    key={def.key}
                    onPress={() => toggleOptional(def.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: sel.enabled }}
                    style={({ pressed }) => [
                      s.optRow,
                      sel.enabled && s.optRowOn,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={[s.optBox, sel.enabled && s.optBoxOn]}>
                      {sel.enabled ? <Text style={s.optCheck}>✓</Text> : null}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={s.optHead}>
                        <Text style={s.optTitle}>{def.short}</Text>
                        {likely && !sel.enabled ? (
                          <View style={s.likely}>
                            <Text style={s.likelyText}>LIKELY</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={s.optHint}>{def.hint}</Text>
                      {sel.enabled ? (
                        <Text style={s.optBasis}>{resolved.basis}</Text>
                      ) : null}
                    </View>

                    <Text style={[s.optAmount, sel.enabled && { color: colors.accent }]}>
                      {usd(resolved.total)}
                    </Text>
                  </Pressable>
                );
              })}

            {/* Amount editors only for what is actually turned on. */}
            {selectedCount > 0 ? (
              <View style={s.block}>
                <Text style={s.blockLabel}>ADJUST AMOUNTS</Text>
                <Card>
                  {trip.optionalCosts
                    .filter((o) => o.enabled)
                    .map((sel) => {
                      const def = OPTIONAL_COSTS.find((o) => o.key === sel.key);
                      if (!def) return null;
                      return (
                        <Field
                          key={sel.key}
                          label={def.label}
                          value={String(sel.amount)}
                          onChangeText={(v) => setOptionalAmount(sel.key, num(v))}
                          keyboardType="decimal-pad"
                          suffix={modeSuffix(def.mode)}
                        />
                      );
                    })}
                </Card>
              </View>
            ) : null}

            {/* Already-incurred costs live here too, so it is one place to look. */}
            <View style={s.block}>
              <Text style={s.blockLabel}>ALREADY WENT WRONG</Text>
              {addedCosts.map((c) => (
                <Card key={c.id} accent={colors.red}>
                  <View style={s.optHead}>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '700' }}>{c.label}</Body>
                      <Dim>{CATEGORY_LABELS[c.category]}</Dim>
                    </View>
                    <Text style={s.incidentAmt}>{usd(c.amount)}</Text>
                  </View>
                  <Button title="Remove" variant="danger" onPress={() => removeCost(c.id)} />
                </Card>
              ))}
              <Button title="📷  Scan a bill" variant="secondary" onPress={() => router.push('/scan')} />
              <Button
                title="+ Enter by hand"
                variant="ghost"
                onPress={() => router.push('/add-cost?target=trip')}
              />
            </View>

            <Card accent={colors.accent}>
              <Text style={s.blockLabel}>EXTRAS ON THIS LOAD</Text>
              <Text style={s.extrasTotal}>{usd(extrasTotal + addedCosts.reduce((a, c) => a + c.amount, 0))}</Text>
              <Dim>
                {selectedCount === 0 && addedCosts.length === 0
                  ? 'Nothing added. Fuel, tolls and wear are still counted.'
                  : `${selectedCount} selected${addedCosts.length > 0 ? ` · ${addedCosts.length} unplanned` : ''} — on top of the fixed costs.`}
              </Dim>
            </Card>
          </>
        ) : null}

        {error ? (
          <Card accent={colors.red}>
            <Body style={{ color: colors.red }}>{error}</Body>
          </Card>
        ) : null}
      </ScrollView>

      {/* --- Action bar -------------------------------------------------------- */}
      <View style={s.footer}>
        {building ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.accent} />
            <Dim>Building brief…</Dim>
          </View>
        ) : (
          <View style={s.footerRow}>
            {step > 0 ? (
              <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
            ) : (
              <Button
                title="Skip"
                variant="ghost"
                onPress={onGenerate}
                style={{ flex: 1 }}
              />
            )}
            <Button
              title={isLast ? 'Get Brief' : 'Next'}
              onPress={() => (isLast ? onGenerate() : setStep(step + 1))}
              style={{ flex: 2 }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/** Big, glove-friendly tap target. */
function Tap({
  title,
  sub,
  icon,
  on,
  onPress,
  big,
}: {
  title: string;
  sub?: string;
  icon?: string;
  on: boolean;
  onPress: () => void;
  big?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        s.tap,
        big && s.tapBig,
        on && s.tapOn,
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon ? <Text style={s.tapIcon}>{icon}</Text> : null}
      <Text style={[s.tapTitle, on && { color: colors.text }]}>{title}</Text>
      {sub ? <Text style={s.tapSub}>{sub}</Text> : null}
    </Pressable>
  );
}

function num(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  progressWrap: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  progressBar: { flexDirection: 'row', gap: space.sm },
  progressSeg: { flex: 1, gap: 6, paddingVertical: 4 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressTrackOn: { backgroundColor: colors.accent },
  progressLabel: { ...type.tiny, color: colors.textFaint },
  progressLabelOn: { color: colors.accent },

  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.lg },

  question: { ...type.h1, color: colors.text, lineHeight: 30 },

  block: { gap: space.sm },
  blockLabel: { ...type.tiny, color: colors.textFaint, textTransform: 'uppercase' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  tap: {
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapBig: { width: '47%', minHeight: 88 },
  tapOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  tapIcon: { fontSize: 26, marginBottom: 4 },
  tapTitle: { ...type.h3, color: colors.textDim },
  tapSub: { ...type.tiny, color: colors.textFaint, marginTop: 2 },

  departValue: { ...type.h2, color: colors.text, fontVariant: ['tabular-nums'] },

  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 72,
  },
  optRowOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  optBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optCheck: { color: '#1B1206', fontWeight: '900', fontSize: 16 },
  optHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  optTitle: { ...type.h3, color: colors.text },
  optHint: { ...type.small, color: colors.textFaint, lineHeight: 17, marginTop: 2 },
  optBasis: { ...type.small, color: colors.accent, marginTop: 3 },
  optAmount: { ...type.h3, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  likely: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.blueDim,
  },
  likelyText: { ...type.tiny, color: colors.blue },

  incidentAmt: { ...type.h3, color: colors.red, fontVariant: ['tabular-nums'] },
  extrasTotal: { fontSize: 32, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] },

  footer: {
    padding: space.lg,
    paddingBottom: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: { flexDirection: 'row', gap: space.sm },
  loading: { flexDirection: 'row', gap: space.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
});
