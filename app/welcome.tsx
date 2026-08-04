import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/store/auth';
import { FeatureTile, HeroArt, SampleBrief, Step } from '../src/ui/art';
import { Body, Button, Card, Dim, Label, Screen } from '../src/ui/components';
import { colors, radius, space, type } from '../src/ui/theme';

/**
 * The public page. Everything a stranger at the URL is allowed to see.
 *
 * No fleet, no trucks, no costs — those live behind the gate. What this has to
 * do is say what the thing is inside a few seconds, show the actual output
 * rather than describing it, and offer a way in.
 *
 * Ordered the way a carrier evaluates software: what is it → what does it give
 * me → how do I start → what does it cost me → what are the limits. The
 * limitations stay on the page rather than being buried, because a dispatcher
 * who finds out later that routing is an estimate stops trusting the numbers
 * that are right.
 */
export default function WelcomeScreen() {
  const { enterDemo, backendConfigured } = useAuth();

  const tryDemo = () => {
    enterDemo();
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      {/* --- Masthead --------------------------------------------------------- */}
      <View style={s.masthead}>
        <View style={s.brand}>
          <View style={s.mark}>
            <View style={s.markRoad} />
          </View>
          <Text style={s.wordmark}>TripCost</Text>
        </View>
        {backendConfigured ? (
          <Text style={s.navLink} onPress={() => router.push('/login')}>
            Sign in
          </Text>
        ) : null}
      </View>

      {/* --- Hero ------------------------------------------------------------- */}
      <HeroArt />

      <View style={s.heroCopy}>
        <Text style={s.headline}>Know what a load pays before you book it.</Text>
        <Text style={s.subhead}>
          Trip costing, hours planning and fleet reporting for CDL carriers and owner-operators.
          Built around what a truck actually costs to run — not a rate-per-mile guess.
        </Text>
      </View>

      {/* --- Primary actions -------------------------------------------------- */}
      {backendConfigured ? (
        <View style={{ gap: space.sm }}>
          <Button title="Create a carrier account" onPress={() => router.push('/signup')} />
          <Button title="Sign in" variant="secondary" onPress={() => router.push('/login')} />
          <Button title="See the demo first" variant="ghost" onPress={tryDemo} />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title="Try the demo" onPress={tryDemo} />
          <Card accent={colors.amber}>
            <Label>Accounts not connected yet</Label>
            <Body>
              Sign-in needs a database behind it and this build does not have one wired. The demo
              below is the only way in.
            </Body>
          </Card>
        </View>
      )}

      <Text style={s.reassure}>
        Free to try · No card required · Your fleet and rates stay private to your company
      </Text>

      {/* --- Proof: the actual output ----------------------------------------- */}
      <View style={s.band}>
        <Text style={s.eyebrow}>WHAT YOU GET</Text>
        <Text style={s.bandTitle}>Every load, costed against your truck</Text>
        <Text style={s.bandSub}>
          Fuel at regional prices, tires, maintenance, the payment, insurance, tolls and per diem —
          split out so you can see where the money goes and what the load has to pay to clear.
        </Text>
      </View>

      <SampleBrief />

      {/* --- Features --------------------------------------------------------- */}
      <View style={s.grid}>
        <FeatureTile
          icon="calculator"
          title="Break-even, not guesswork"
          body="Costs the load against your truck's real numbers and tells you the rate you need. Deadhead counts as cost, never revenue."
        />
        <FeatureTile
          icon="time"
          title="Hours that hold up"
          body="11-hour driving limit, 14-hour window, 30-minute break, 10-hour reset — and whether the load can be delivered legally on time."
          tint={colors.blue}
        />
        <FeatureTile
          icon="rainy"
          title="Weather where you'll be"
          body="Live National Weather Service forecasts for the hour you actually reach each segment, not the weather at departure."
          tint={colors.green}
        />
        <FeatureTile
          icon="bar-chart"
          title="Fleet cost, day to year"
          body="Per truck, combined, or any group you pick. Operating ratio, cost per mile, and which unit is dragging the rest down."
          tint="#A371F7"
        />
        <FeatureTile
          icon="people"
          title="Drivers and compliance"
          body="Assign drivers to units, track CDL and medical expiry, and see who is seated and who is on the bench."
          tint={colors.amber}
        />
        <FeatureTile
          icon="shield-checkmark"
          title="A driver copy with no rates"
          body="Send the route, hours, weather and fuel plan. Costs and margins are structurally absent — not hidden, absent."
          tint={colors.blue}
        />
      </View>

      {/* --- How it works ----------------------------------------------------- */}
      <View style={s.band}>
        <Text style={s.eyebrow}>GETTING STARTED</Text>
        <Text style={s.bandTitle}>Running in about ten minutes</Text>
      </View>

      <Card>
        <View style={{ gap: space.lg }}>
          <Step
            n={1}
            title="Create your carrier account"
            body="You become the owner. Your fleet, costs and driver records are visible only to accounts you invite."
          />
          <Step
            n={2}
            title="Add your trucks"
            body="Payment, insurance, fuel economy, maintenance. Start from the industry defaults and correct them as you learn your real numbers."
          />
          <Step
            n={3}
            title="Invite your drivers"
            body="Each gets a single-use code and makes their own login. You never handle a driver's password."
          />
          <Step
            n={4}
            title="Cost a load"
            body="Origin, destination, rate. You get the break-even, the hours plan, the weather and a driver copy to send."
          />
        </View>
      </Card>

      {/* --- Who it is for ---------------------------------------------------- */}
      <View style={s.split}>
        <View style={s.splitCard}>
          <Ionicons name="person" size={22} color={colors.accent} />
          <Text style={s.splitTitle}>Owner-operators</Text>
          <Text style={s.splitBody}>
            One truck, one set of numbers. Find out whether the load clears your costs before you
            take it, and what you have to float until you get paid.
          </Text>
        </View>
        <View style={s.splitCard}>
          <Ionicons name="business" size={22} color={colors.blue} />
          <Text style={s.splitTitle}>Carriers and fleets</Text>
          <Text style={s.splitBody}>
            Every truck's cost per mile, drivers attached to units, compliance dates in one place,
            and a ledger that tells you which unit is actually earning.
          </Text>
        </View>
      </View>

      {/* --- Privacy ---------------------------------------------------------- */}
      <Card accent={colors.green}>
        <Label>Your data</Label>
        <Body>
          Every table in the database is scoped to your company and enforced by Postgres itself, not
          by application code remembering to filter. Drivers see their own truck and their own
          loads — never costs, never rates, never another driver's records.
        </Body>
      </Card>

      {/* --- Limits ----------------------------------------------------------- */}
      <Card accent={colors.amber}>
        <Label>What it is not</Label>
        <Body>
          A planning tool. Not an ELD, not a system of record for hours of service, and not legal,
          tax or financial advice.
        </Body>
        <Dim style={{ marginTop: space.xs }}>
          Your ELD is the authority on your available hours, and the driver is the authority on
          whether a load can be run safely. Fuel prices are regional averages rather than
          per-station, and traffic and road restrictions are modeled rather than live — the app
          labels every feed so you always know which is which.
        </Dim>
      </Card>

      {/* --- Closing ---------------------------------------------------------- */}
      {backendConfigured ? (
        <View style={{ gap: space.sm }}>
          <Button title="Create a carrier account" onPress={() => router.push('/signup')} />
          <Button title="See the demo first" variant="ghost" onPress={tryDemo} />
        </View>
      ) : (
        <Button title="Try the demo" onPress={tryDemo} />
      )}

      <View style={s.footer}>
        <Text style={s.footerBrand}>TripCost</Text>
        <Text style={s.footerText}>
          Trip costing and fleet management for CDL carriers. Built by a former USMC motor transport
          operator.
        </Text>
        <Text style={s.footerText}>tripcost.us</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  // --- Masthead -------------------------------------------------------------
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  markRoad: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 21,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.accent,
  },
  wordmark: { ...type.h1, color: colors.text, fontSize: 21 },
  navLink: { ...type.h3, color: colors.accent, paddingVertical: space.sm },

  // --- Hero -----------------------------------------------------------------
  heroCopy: { gap: space.sm },
  headline: { ...type.hero, color: colors.text, fontSize: 30, lineHeight: 36 },
  subhead: { ...type.body, color: colors.textDim, lineHeight: 22 },
  reassure: {
    ...type.small,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 18,
  },

  // --- Section bands --------------------------------------------------------
  band: { gap: 6, paddingTop: space.md },
  eyebrow: { ...type.tiny, color: colors.accent },
  bandTitle: { ...type.h1, color: colors.text },
  bandSub: { ...type.body, color: colors.textDim, lineHeight: 22 },

  // --- Feature grid ---------------------------------------------------------
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  // --- Audience split -------------------------------------------------------
  split: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  splitCard: {
    flexGrow: 1,
    flexBasis: 240,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  splitTitle: { ...type.h2, color: colors.text },
  splitBody: { ...type.small, color: colors.textDim, lineHeight: 19 },

  // --- Footer ---------------------------------------------------------------
  footer: {
    gap: 6,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBrand: { ...type.h3, color: colors.textDim },
  footerText: { ...type.small, color: colors.textFaint, lineHeight: 18 },
});
