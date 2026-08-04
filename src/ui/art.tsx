import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
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

/**
 * The hero: a planned run from origin to delivery, with the stops the app
 * actually works out along the way.
 *
 * This replaced a decorative sunset. A landing page for a planning tool should
 * show the plan — a dispatcher looking at this sees a fuel stop, a mandatory
 * break and an overnight laid out on a route, which is precisely what the
 * product produces. Scenery says trucking; this says what the software does.
 *
 * Drawn at 400×180 in the viewBox and scaled to fit, so it is sharp on any
 * display and costs nothing to download.
 */
export function HeroArt() {
  return (
    <View
      style={s.hero}
      accessible
      accessibilityLabel="A planned truck route from Dallas to Chicago showing a fuel stop, a required break and an overnight"
    >
      {/*
        `meet` plus a container locked to the same aspect ratio, so nothing is
        ever cropped. `slice` looked fine on a desktop window and quietly cut
        the origin label off the bottom — and on a phone, where the panel is
        narrower than the viewBox, it would have cropped the sides instead and
        taken the destination with it.
      */}
      <Svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid meet">
        {/* Faint grid, so the panel reads as a planning surface not a picture. */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Line
            key={`h${i}`}
            x1={0}
            y1={22 + i * 28}
            x2={400}
            y2={22 + i * 28}
            stroke={colors.border}
            strokeWidth={0.6}
            opacity={0.5}
          />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <Line
            key={`v${i}`}
            x1={i * 40}
            y1={0}
            x2={i * 40}
            y2={180}
            stroke={colors.border}
            strokeWidth={0.6}
            opacity={0.35}
          />
        ))}

        {/* The route. A wide dim casing under a bright stroke gives the line
            weight without a blur filter, which react-native-svg does not
            render consistently across web and native. */}
        <Path d={ROUTE} stroke={colors.accentDim} strokeWidth={9} fill="none" strokeLinecap="round" />
        <Path d={ROUTE} stroke={colors.accent} strokeWidth={3} fill="none" strokeLinecap="round" />

        {/* Remaining leg, dashed — the part not yet driven. */}
        <Path
          d={REMAINING}
          stroke={colors.accent}
          strokeWidth={2.4}
          fill="none"
          strokeDasharray="7 6"
          strokeLinecap="round"
          opacity={0.55}
        />

        {/* Waypoints. Each is a stop the planner actually computes. */}
        {STOPS.map((stop) => (
          <React.Fragment key={stop.label}>
            <Circle cx={stop.x} cy={stop.y} r={7} fill={colors.bg} />
            <Circle cx={stop.x} cy={stop.y} r={4.5} fill={stop.color} />
            <SvgText
              x={stop.x}
              y={stop.y - 13}
              fill={colors.textDim}
              fontSize={9}
              fontWeight="700"
              fontFamily={LABEL_FONT}
              textAnchor="middle"
            >
              {stop.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Origin and destination, drawn heavier than the intermediate stops. */}
        <Circle cx={22} cy={132} r={9} fill={colors.bg} />
        <Circle cx={22} cy={132} r={5.5} fill={colors.green} />
        <SvgText
          x={22}
          y={155}
          fill={colors.text}
          fontSize={10}
          fontWeight="800"
          fontFamily={LABEL_FONT}
          textAnchor="middle"
        >
          DAL
        </SvgText>

        <Circle cx={378} cy={40} r={9} fill={colors.bg} />
        <Circle cx={378} cy={40} r={5.5} fill={colors.red} />
        <SvgText
          x={378}
          y={63}
          fill={colors.text}
          fontSize={10}
          fontWeight="800"
          fontFamily={LABEL_FONT}
          textAnchor="middle"
        >
          CHI
        </SvgText>

        {/*
          The truck, sitting on the route where it has got to. Same silhouette
          as the logo (src/ui/Logo.tsx), scaled to half and with the road line
          dropped — here the route *is* the road. White rather than amber so
          the vehicle stays distinct from the path it is on.
        */}
        <G transform="translate(133.75, 55.3) scale(0.5)">
          <Rect x={4} y={17} width={34} height={20} rx={1.5} fill={colors.text} />
          <Rect x={38.6} y={12.5} width={1.8} height={7} rx={0.6} fill={colors.text} />
          <Path d="M41 19 h9 v7 h6 l3 4 v7 h-18 z" fill={colors.text} />
          <Rect x={44} y={21} width={4.5} height={4} rx={0.6} fill="#0A0F16" />
          {[13, 22, 45, 54].map((cx) => (
            <React.Fragment key={cx}>
              <Circle cx={cx} cy={41} r={4.4} fill={colors.text} />
              <Circle cx={cx} cy={41} r={1.8} fill="#0A0F16" />
            </React.Fragment>
          ))}
        </G>
      </Svg>
    </View>
  );
}

/**
 * SVG text does not inherit the app's typography and falls back to a serif
 * face, which looks nothing like the rest of the page. Named explicitly.
 */
const LABEL_FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

/** Driven so far, then the leg still ahead. Split at the truck's position. */
const ROUTE = 'M22 132 C 70 132, 96 96, 150 78';
const REMAINING = 'M150 78 C 214 56, 250 104, 296 88 S 350 46, 378 40';

const STOPS = [
  { x: 96, y: 104, label: 'FUEL', color: colors.accent },
  { x: 232, y: 78, label: 'BREAK', color: colors.blue },
  { x: 296, y: 88, label: '10-HR', color: '#A371F7' },
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
    width: '100%',
    // Locked to the viewBox ratio so the illustration scales rather than crops.
    // No maxHeight: clamping the height breaks the ratio and letterboxes the
    // grid, which then stops short of the panel edge and looks like a bug.
    aspectRatio: 400 / 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0A0F16',
    borderWidth: 1,
    borderColor: colors.border,
  },

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
