import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from './theme';

/**
 * Artwork for the landing page, drawn in code rather than shipped as photos.
 *
 * Two reasons, and the second is the real one:
 *
 *  - Weight. A hero photograph is 200–800 KB. This whole file costs nothing
 *    extra to download and stays sharp at any density, which matters when a
 *    driver opens the site on a phone hanging off a truck-stop hotspot.
 *
 *  - Honesty. Stock photography of a shiny fleet implies a customer base and a
 *    scale that does not exist yet. Rendering the actual product — a road, a
 *    cost split, a status band — shows what the app does instead of dressing it
 *    up as something it is not.
 *
 * If real photography is wanted later it needs licensed images; these are
 * drop-in replaceable.
 */

// ---------------------------------------------------------------------------
// Hero: a road running to the horizon, with the load's numbers over it.
// ---------------------------------------------------------------------------

export function HeroArt() {
  return (
    <View style={s.hero} accessible accessibilityLabel="A highway running to the horizon at dusk">
      {/* Sky. Three flat bands rather than a gradient — no gradient library, and
          at this size the banding reads as dusk haze anyway. */}
      <View style={s.sky} />
      <View style={s.skyMid} />
      <View style={s.skyWarm} />

      {/* Sun sitting on the horizon, its lower half cut off by the ground. */}
      <View style={s.sun} />

      {/* Ground, then the road: a wider light trapezoid behind a darker one, so
          the difference between them becomes the shoulder lines and tapers
          correctly toward the vanishing point. */}
      <View style={s.ground} />
      <View style={s.shoulder} />
      <View style={s.road} />

      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[s.laneDash, LANE_DASHES[i]]} />
      ))}

      {/* Mile markers either side, small and dim — texture, not content. */}
      <View style={[s.post, { left: '15%', bottom: 20, height: 26 }]} />
      <View style={[s.post, { right: '15%', bottom: 20, height: 26 }]} />
      <View style={[s.post, { left: '29%', bottom: 44, height: 14 }]} />
      <View style={[s.post, { right: '29%', bottom: 44, height: 14 }]} />
      <View style={[s.post, { left: '38%', bottom: 58, height: 8 }]} />
      <View style={[s.post, { right: '38%', bottom: 58, height: 8 }]} />
    </View>
  );
}

/** Dash positions, hand-placed so they foreshorten toward the horizon. */
const LANE_DASHES = [
  { bottom: 6, width: 11, height: 18, opacity: 1 },
  { bottom: 34, width: 8, height: 13, opacity: 0.8 },
  { bottom: 56, width: 5, height: 8, opacity: 0.55 },
  { bottom: 71, width: 4, height: 5, opacity: 0.32 },
];

// ---------------------------------------------------------------------------
// A sample of the actual output, so the page shows the product not a promise.
// ---------------------------------------------------------------------------

export function SampleBrief() {
  return (
    <View style={s.sample}>
      <View style={s.sampleHead}>
        <Text style={s.sampleRoute}>DALLAS, TX → CHICAGO, IL</Text>
        <View style={s.sampleBadge}>
          <Text style={s.sampleBadgeText}>GREEN</Text>
        </View>
      </View>

      <Text style={s.sampleLine}>968 mi · 2 days · delivers with 3h to spare</Text>

      <View style={s.splitTrack}>
        {COST_SPLIT.map((seg) => (
          <View key={seg.label} style={{ flex: seg.share, backgroundColor: seg.color }} />
        ))}
      </View>

      <View style={s.legend}>
        {COST_SPLIT.map((seg) => (
          <View key={seg.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: seg.color }]} />
            <Text style={s.legendText}>{seg.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.sampleFoot}>
        <View>
          <Text style={s.sampleLabel}>BREAK-EVEN</Text>
          <Text style={s.sampleFigure}>$1.94/mi</Text>
        </View>
        <View>
          <Text style={s.sampleLabel}>OFFERED</Text>
          <Text style={s.sampleFigure}>$2.55/mi</Text>
        </View>
        <View>
          <Text style={s.sampleLabel}>NET</Text>
          <Text style={[s.sampleFigure, { color: colors.profit }]}>+$591</Text>
        </View>
      </View>

      <Text style={s.sampleNote}>Sample figures, shown to illustrate the output.</Text>
    </View>
  );
}

const COST_SPLIT = [
  { label: 'Fuel', share: 34, color: colors.accent },
  { label: 'Driver', share: 27, color: colors.green },
  { label: 'Fixed', share: 22, color: '#A371F7' },
  { label: 'Variable', share: 17, color: colors.blue },
];

// ---------------------------------------------------------------------------
// Feature tile
// ---------------------------------------------------------------------------

export function FeatureTile({
  icon,
  title,
  body,
  tint = colors.accent,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  tint?: string;
}) {
  return (
    <View style={s.tile}>
      <View style={[s.tileIcon, { backgroundColor: `${tint}22`, borderColor: `${tint}55` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.tileBody}>{body}</Text>
    </View>
  );
}

/** Numbered step for the "how it works" band. */
export function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={s.step}>
      <View style={s.stepNum}>
        <Text style={s.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  // --- Hero -----------------------------------------------------------------
  hero: {
    height: 210,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#080D14',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
  },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0A1119' },
  skyMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    height: 56,
    backgroundColor: '#152233',
  },
  // A thin warm band right at the horizon — the last of the light.
  skyWarm: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    height: 14,
    backgroundColor: '#3A2E1C',
    opacity: 0.75,
  },
  sun: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 90,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    opacity: 0.5,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
    backgroundColor: '#080C12',
    borderTopWidth: 1,
    borderTopColor: '#28384A',
  },
  // Trapezoid: a wide bottom border with inward-sloping sides reads as a road
  // in perspective without needing an SVG renderer. The shoulder sits behind
  // the road and is 8pt wider, so what shows past the edges is the fog line —
  // and because both taper to the same point, it narrows correctly with distance.
  shoulder: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 142,
    borderRightWidth: 142,
    borderBottomWidth: 96,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#4A5F78',
  },
  road: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 134,
    borderRightWidth: 134,
    borderBottomWidth: 96,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1B2530',
  },
  laneDash: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  post: { position: 'absolute', width: 2, backgroundColor: '#31425A', borderRadius: 1 },

  // --- Sample brief ---------------------------------------------------------
  sample: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  sampleHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sampleRoute: { ...type.h3, color: colors.text, flex: 1, letterSpacing: 0.3 },
  sampleBadge: {
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  sampleBadgeText: { ...type.tiny, color: colors.green },
  sampleLine: { ...type.small, color: colors.textDim },

  splitTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: space.xs,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...type.small, color: colors.textFaint },

  sampleFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sampleLabel: { ...type.tiny, color: colors.textFaint },
  sampleFigure: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  sampleNote: { ...type.small, color: colors.textFaint, fontSize: 11, marginTop: 2 },

  // --- Feature tile ---------------------------------------------------------
  tile: {
    flexGrow: 1,
    flexBasis: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { ...type.h3, color: colors.text },
  tileBody: { ...type.small, color: colors.textDim, lineHeight: 19 },

  // --- Step -----------------------------------------------------------------
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { ...type.tiny, color: colors.accent, fontSize: 12 },
  stepTitle: { ...type.h3, color: colors.text, marginBottom: 3 },
  stepBody: { ...type.small, color: colors.textDim, lineHeight: 19 },
});
