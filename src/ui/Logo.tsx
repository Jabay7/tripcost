import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, radius, type } from './theme';

/**
 * The TripCost mark: a tractor-trailer in profile, running on a road line.
 *
 * Why a truck and not something abstract. The mark appears next to the
 * wordmark on a landing page, on a phone home screen at 48px, and on a
 * browser tab at 16px. At those sizes a clever abstract shape becomes a
 * smudge, and a carrier scanning a list of apps has to be able to tell what
 * this one is at a glance. A silhouetted semi is the one shape that survives
 * every size and needs no explanation.
 *
 * The road line under the wheels is the tie to the rest of the product — the
 * same amber that marks every route, lane and active state in the app.
 */

/** Viewbox is 64×64. Everything below is expressed in that space. */
const VB = 64;

export function LogoMark({ size = 36, boxed = true }: { size?: number; boxed?: boolean }) {
  const svg = (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      {/*
        Trailer box. Long and tall — roughly 2:1 is the proportion that reads
        as "semi" rather than "delivery van".
      */}
      <Rect x={4} y={17} width={34} height={20} rx={1.5} fill={colors.accent} />

      {/* Exhaust stack behind the cab. The one detail that separates a semi
          from a box truck at a glance; too thin to matter below ~24px, but it
          costs nothing there and defines the shape above it. */}
      <Rect x={38.6} y={12.5} width={1.8} height={7} rx={0.6} fill={colors.accent} />

      {/*
        Tractor: tall cab, then a hood that steps down and slopes to the bumper
        — a conventional long-nose rig. One path, so the silhouette stays a
        single solid shape rather than breaking into slivers that vanish at 16px.
      */}
      <Path d="M41 19 h9 v7 h6 l3 4 v7 h-18 z" fill={colors.accent} />

      {/* Window, punched out in the background colour so it reads as glass. */}
      <Rect x={44} y={21} width={4.5} height={4} rx={0.6} fill={colors.bg} />

      {/* Wheels: trailer bogie, drive axle under the cab, steer under the hood. */}
      {[13, 22, 45, 54].map((cx) => (
        <React.Fragment key={cx}>
          <Circle cx={cx} cy={41} r={4.4} fill={colors.accent} />
          <Circle cx={cx} cy={41} r={1.8} fill={colors.bg} />
        </React.Fragment>
      ))}

      {/* Road. One unbroken line under the whole rig — an earlier version faded
          the right-hand end and left the steer wheel sitting on nothing. */}
      <Rect x={3} y={47.5} width={59} height={2.6} rx={1.3} fill={colors.accent} />
    </Svg>
  );

  if (!boxed) return svg;

  return <View style={[s.box, { width: size * 1.5, height: size * 1.5 }]}>{svg}</View>;
}

/** Mark plus wordmark, for the landing page masthead. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={s.row}>
      <LogoMark size={size} />
      <Text style={[s.wordmark, { fontSize: size * 0.62 }]}>TripCost</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { ...type.h1, color: colors.text, letterSpacing: -0.4 },
});
