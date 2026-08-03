import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WALKTHROUGH_STEPS } from '../src/data/walkthrough';
import { useStore } from '../src/store/store';
import { Body, Button, Card, Dim, Label, Screen } from '../src/ui/components';
import { colors, radius, space, type } from '../src/ui/theme';

/**
 * The first thing anyone sees, once.
 *
 * Two doors, no dark patterns: someone who already runs a TMS should be one tap
 * from the app, and someone who has never seen it should not have to guess
 * their way in. Both answers are equally easy to pick — the walkthrough is not
 * the default and the skip is not buried.
 *
 * Either choice marks onboarding done, so this screen never appears again
 * unannounced. It stays reachable from Drivers → "How this app works".
 */
export default function WelcomeScreen() {
  const { completeOnboarding } = useStore();

  const skip = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const tour = () => {
    // Marked complete on entry rather than on finish: someone who bails halfway
    // through has still made their choice, and re-prompting them next launch
    // would be nagging.
    completeOnboarding();
    router.replace('/walkthrough');
  };

  return (
    <Screen>
      <View style={s.header}>
        <View style={s.mark}>
          <View style={s.road} />
        </View>
        <Text style={s.title}>TripCost</Text>
        <Text style={s.tagline}>A convoy brief for civilian CDL drivers.</Text>
      </View>

      <Card>
        <Body>
          Work out what a load actually pays before you book it, know what the road is going to do to
          you along the way, and track what your trucks cost to run.
        </Body>
      </Card>

      <View style={{ gap: space.sm }}>
        <Text style={s.question}>Have you used something like this before?</Text>

        <Button title="Show me how it works" onPress={tour} />
        <Text style={s.under}>
          {WALKTHROUGH_STEPS} short screens, about two minutes. You can stop at any point.
        </Text>

        <View style={s.gap} />

        <Button title="I know my way around — go to the app" variant="secondary" onPress={skip} />
        <Text style={s.under}>
          You can open the walkthrough later from the Drivers tab if you change your mind.
        </Text>
      </View>

      <Card accent={colors.amber}>
        <Label>Before you trust a number</Label>
        <Dim>
          The app opens with a sample fleet and industry-average costs so you can see how it works.
          Replace them with your own figures on the Trucks tab before you make a decision with them —
          your settlement statements always beat an average.
        </Dim>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', gap: space.sm, paddingTop: space.xl },
  mark: {
    width: 92,
    height: 92,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  // A flat nod to the app icon: a road narrowing to a vanishing point.
  road: {
    width: 0,
    height: 0,
    borderLeftWidth: 30,
    borderRightWidth: 30,
    borderBottomWidth: 58,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.accent,
  },
  title: { ...type.hero, color: colors.text },
  tagline: { ...type.body, color: colors.textDim, textAlign: 'center' },

  question: { ...type.h2, color: colors.text, marginBottom: space.xs },
  under: { ...type.small, color: colors.textFaint, lineHeight: 18, paddingHorizontal: 2 },
  gap: { height: space.md },
});
