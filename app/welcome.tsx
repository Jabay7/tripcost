import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/store/auth';
import { Body, Button, Card, Dim, Label, Screen } from '../src/ui/components';
import { colors, radius, space, type } from '../src/ui/theme';

/**
 * The public page. Everything a stranger at the URL is allowed to see.
 *
 * No fleet, no trucks, no costs — those live behind the gate. What this has to
 * do is explain what the thing is, offer a way in, and be honest that the demo
 * is a demo.
 */
export default function WelcomeScreen() {
  const { enterDemo, backendConfigured } = useAuth();

  const tryDemo = () => {
    enterDemo();
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={s.header}>
        <View style={s.mark}>
          <View style={s.road} />
        </View>
        <Text style={s.title}>TripCost</Text>
        <Text style={s.tagline}>Trip costing and fleet management for CDL carriers.</Text>
      </View>

      <Card>
        <Body>
          Work out what a load actually pays before you book it. Track what every truck costs to
          run. Send drivers a brief with the route, hours, weather and fuel plan — and none of your
          rates.
        </Body>
      </Card>

      {/* --- Sign in ---------------------------------------------------------- */}
      {backendConfigured ? (
        <View style={{ gap: space.sm }}>
          <Button title="Sign in" onPress={() => router.push('/login')} />
          <Button
            title="Create a carrier account"
            variant="secondary"
            onPress={() => router.push('/signup')}
          />
          <Text style={s.under}>
            Your fleet, costs and driver records are private to your company and visible only to
            accounts you invite.
          </Text>
        </View>
      ) : (
        <Card accent={colors.amber}>
          <Label>Accounts not connected yet</Label>
          <Body>
            Sign-in needs a database behind it, and this build does not have one wired. Until then
            the demo below is the only way in.
          </Body>
          <Dim style={{ marginTop: space.sm }}>
            Setup instructions are in the project's README under Accounts.
          </Dim>
        </Card>
      )}

      {/* --- Demo ------------------------------------------------------------- */}
      <View style={{ gap: space.sm }}>
        <Button
          title="Try the demo"
          variant={backendConfigured ? 'ghost' : 'primary'}
          onPress={tryDemo}
        />
        <Text style={s.under}>
          Opens a sample carrier with three invented trucks so you can see how it works. The data is
          made up, stays in this browser, and is never sent anywhere.
        </Text>
      </View>

      <Card>
        <Label>What it does</Label>
        <View style={s.list}>
          {[
            'Costs a load against your truck — fuel, tires, maintenance, payment, tolls, per diem — and tells you the break-even rate.',
            'Plans the hours: 11-hour limit, 14-hour window, 30-minute break, 10-hour reset, and whether the load can be delivered legally on time.',
            'Live weather along the route for the time you will actually be there, plus closures and hazmat restrictions.',
            'Fleet cost per truck and combined, day through year, with operating ratio.',
            'A driver copy of the brief with every rate and cost removed.',
          ].map((line, i) => (
            <View key={i} style={s.item}>
              <Text style={s.bullet}>▸</Text>
              <Body style={{ flex: 1 }}>{line}</Body>
            </View>
          ))}
        </View>
      </Card>

      <Card accent={colors.amber}>
        <Label>What it is not</Label>
        <Dim>
          A planning tool. Not an ELD, not a system of record for hours of service, and not legal or
          tax advice. Your ELD is the authority on your available hours.
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

  under: { ...type.small, color: colors.textFaint, lineHeight: 18, paddingHorizontal: 2 },

  list: { gap: 2 },
  item: { flexDirection: 'row', gap: space.sm, paddingVertical: 5 },
  bullet: { color: colors.accent, fontWeight: '900', fontSize: 14, marginTop: 3 },
});
