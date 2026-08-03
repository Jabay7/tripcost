import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WALKTHROUGH } from '../src/data/walkthrough';
import { Body, Button, Card, Dim, Label } from '../src/ui/components';
import { colors, radius, space, type } from '../src/ui/theme';

/**
 * The walkthrough.
 *
 * A paged explainer rather than coach marks over the live UI. Coach-mark tours
 * teach which button to press; they do not teach why cash-to-float is separate
 * from profit, which is the thing that actually determines whether someone gets
 * right answers out of this app. So each page leads with the concept.
 *
 * Escape hatches everywhere: the rail is tappable, Back works, and "Skip the
 * rest" is on every page. Nobody is trapped in a tutorial.
 */
export default function WalkthroughScreen() {
  const [i, setI] = useState(0);
  const step = WALKTHROUGH[i];
  const isLast = i === WALKTHROUGH.length - 1;

  const finish = () => router.replace('/(tabs)');

  return (
    <View style={s.root}>
      {/* --- Progress rail ------------------------------------------------- */}
      <View style={s.rail}>
        {WALKTHROUGH.map((st, idx) => (
          <Pressable
            key={st.id}
            onPress={() => setI(idx)}
            accessibilityRole="button"
            accessibilityLabel={`Step ${idx + 1}: ${st.chip}`}
            style={s.railItem}
          >
            <View style={[s.railBar, idx <= i && s.railBarOn]} />
          </Pressable>
        ))}
      </View>

      <View style={s.counter}>
        <Text style={s.chip}>{step.chip.toUpperCase()}</Text>
        <Text style={s.count}>
          {i + 1} of {WALKTHROUGH.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{step.title}</Text>
        <Body style={s.lead}>{step.body}</Body>

        <Card>
          {step.points.map((p, idx) => (
            <View key={idx} style={s.point}>
              <Text style={s.bullet}>▸</Text>
              <Body style={{ flex: 1 }}>{p}</Body>
            </View>
          ))}
        </Card>

        {step.watchOut ? (
          <Card accent={colors.amber}>
            <Label>Worth reading twice</Label>
            <Dim style={s.watchOut}>{step.watchOut}</Dim>
          </Card>
        ) : null}

        {step.visit ? (
          <Button
            title={step.visit.label}
            variant="ghost"
            onPress={() => router.push(step.visit!.href as never)}
          />
        ) : null}
      </ScrollView>

      {/* --- Controls -------------------------------------------------------- */}
      <View style={s.footer}>
        <View style={s.footerRow}>
          {i > 0 ? (
            <Button title="Back" variant="ghost" onPress={() => setI(i - 1)} style={{ flex: 1 }} />
          ) : (
            <Button title="Skip the rest" variant="ghost" onPress={finish} style={{ flex: 1 }} />
          )}
          <Button
            title={isLast ? "Start using it" : 'Next'}
            onPress={() => (isLast ? finish() : setI(i + 1))}
            style={{ flex: 2 }}
          />
        </View>
        {i > 0 && !isLast ? (
          <Pressable onPress={finish} accessibilityRole="button" style={s.skip}>
            <Text style={s.skipText}>Skip the rest</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  rail: { flexDirection: 'row', gap: 4, paddingHorizontal: space.lg, paddingTop: space.md },
  railItem: { flex: 1, paddingVertical: 6 },
  railBar: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  railBarOn: { backgroundColor: colors.accent },

  counter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  chip: { ...type.tiny, color: colors.accent, flex: 1 },
  count: { ...type.tiny, color: colors.textFaint },

  scroll: { padding: space.lg, paddingTop: 0, paddingBottom: space.xxl, gap: space.lg },
  title: { ...type.h1, color: colors.text, lineHeight: 31 },
  lead: { color: colors.textDim, lineHeight: 23 },

  point: { flexDirection: 'row', gap: space.sm, paddingVertical: 5 },
  bullet: { color: colors.accent, fontWeight: '900', fontSize: 14, marginTop: 3 },
  watchOut: { lineHeight: 20 },

  footer: {
    padding: space.lg,
    paddingBottom: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
  footerRow: { flexDirection: 'row', gap: space.sm },
  skip: { alignSelf: 'center', minHeight: 36, justifyContent: 'center' },
  skipText: { ...type.small, color: colors.textFaint, fontWeight: '700' },
});
