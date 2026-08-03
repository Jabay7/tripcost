import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { AlertSeenSet, NwsAlerts, type RoadAlert } from '../src/services/alerts';
import { useTrip } from '../src/store/trip';
import type { LatLng } from '../src/types';
import { Body, Button, Card, Dim, Label, Row, Screen, Section, Pill } from '../src/ui/components';
import { colors, radius, space, type } from '../src/ui/theme';

/**
 * En-route weather watch.
 *
 * The brief tells a driver what to expect before they roll; this tells them
 * what changed after. A blizzard warning issued three hours into a run is
 * precisely the one a pre-trip brief cannot contain.
 *
 * It polls while the screen is open and the app is in the foreground — the
 * dash-mount case, which is how most drivers actually use a phone on a run.
 * Alerts that fire while the phone is locked need push infrastructure the app
 * does not have yet; the screen says so plainly rather than implying coverage
 * it cannot deliver.
 */

const POLL_MS = 5 * 60 * 1000; // NWS updates on the order of minutes, not seconds.
const NWS_USER_AGENT = process.env.EXPO_PUBLIC_NWS_USER_AGENT ?? 'TripCost (support@example.com)';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function EnRouteScreen() {
  const { brief } = useTrip();

  const [watching, setWatching] = useState(false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const seen = useRef(new AlertSeenSet());
  const provider = useRef(new NwsAlerts(NWS_USER_AGENT));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const here = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setPosition(here);

      const found = await provider.current.check(here, brief?.route ?? null);
      setAlerts(found);
      setLastChecked(new Date());

      // Interrupt only for what actually stops a truck, and only once each.
      const fresh = seen.current.takeNew(found).filter((a) => a.critical);
      for (const a of fresh) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: a.milesAhead > 0 ? `${a.event} — ${a.milesAhead} mi ahead` : a.event,
            body: a.headline,
            sound: true,
          },
          trigger: null, // Immediately.
        });
      }
      seen.current.prune(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check for alerts.');
    } finally {
      setChecking(false);
    }
  }, [brief]);

  const start = async () => {
    const loc = await Location.requestForegroundPermissionsAsync();
    if (!loc.granted) {
      setError('Location access is needed to check the weather where you actually are.');
      return;
    }
    // Notification permission is best-effort — the screen still works without
    // it, the driver just has to be looking at it.
    if (Platform.OS !== 'web') {
      await Notifications.requestPermissionsAsync().catch(() => undefined);
    }
    setWatching(true);
    await poll();
  };

  const stop = () => {
    setWatching(false);
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  // Poll on an interval while watching, and immediately on returning to the
  // foreground — a driver who has been off the phone for an hour wants the
  // current picture, not one from when they locked it.
  useEffect(() => {
    if (!watching) return;
    timer.current = setInterval(poll, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') poll();
    });
    return () => {
      if (timer.current) clearInterval(timer.current);
      sub.remove();
    };
  }, [watching, poll]);

  const critical = alerts.filter((a) => a.critical);
  const other = alerts.filter((a) => !a.critical);

  return (
    <Screen>
      <View>
        <Text style={s.hero}>En-route watch</Text>
        <Dim>
          Live National Weather Service alerts for where you are and the road ahead, refreshed every
          five minutes while this screen is open.
        </Dim>
      </View>

      {!watching ? (
        <>
          <Button title="Start watching" onPress={start} />
          <Card>
            <Label>What this covers</Label>
            <Body>
              Alerts for your current position plus sample points up to 250 miles up your route, so a
              warning reaches you with distance left to act on it.
            </Body>
            <Dim style={{ marginTop: space.sm }}>
              Only weather that changes how a truck runs is surfaced — wind, ice, snow, tornado,
              flood, dust, fog. Rip currents and air-quality notices are filtered out.
            </Dim>
          </Card>
          <Card accent={colors.amber}>
            <Label>What it does not cover yet</Label>
            <Body>
              Alerts only arrive while this screen is open and the app is in the foreground. Getting
              a warning with the phone locked needs push notifications and a server watching your
              position — that is not built yet.
            </Body>
            <Dim style={{ marginTop: space.sm }}>
              Keep this screen up on the mount, and keep your weather radio on. This does not replace
              it.
            </Dim>
          </Card>
        </>
      ) : (
        <>
          <Card accent={critical.length > 0 ? colors.red : colors.green}>
            <View style={s.statusRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.status, { color: critical.length ? colors.red : colors.green }]}>
                  {critical.length > 0
                    ? `${critical.length} ACTIVE WARNING${critical.length > 1 ? 'S' : ''}`
                    : 'NO WARNINGS'}
                </Text>
                <Dim>
                  {lastChecked
                    ? `Checked ${lastChecked.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    : 'Checking…'}
                  {position ? ` · ${position.lat.toFixed(2)}, ${position.lon.toFixed(2)}` : ''}
                </Dim>
              </View>
              {checking ? <ActivityIndicator color={colors.accent} /> : null}
            </View>
          </Card>

          {error ? (
            <Card accent={colors.amber}>
              <Body style={{ color: colors.amber }}>{error}</Body>
            </Card>
          ) : null}

          {critical.map((a) => (
            <Card key={a.id} accent={colors.red}>
              <View style={s.alertHead}>
                <Text style={s.alertEvent}>{a.event}</Text>
                <Pill
                  text={a.milesAhead > 0 ? `${a.milesAhead} MI AHEAD` : 'HERE'}
                  color={colors.red}
                  bg={colors.redDim}
                />
              </View>
              <Body>{a.headline}</Body>
              <Row label="Area" value={a.areaDesc.split(';')[0] ?? ''} />
              {a.expires ? (
                <Row
                  label="Expires"
                  value={new Date(a.expires).toLocaleString('en-US', {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                />
              ) : null}
              {a.description ? <Dim style={{ marginTop: space.sm }}>{a.description}</Dim> : null}
            </Card>
          ))}

          {other.length > 0 ? (
            <Section title="Also active" subtitle="Advisories and watches">
              {other.map((a) => (
                <Card key={a.id} accent={colors.amber}>
                  <View style={s.alertHead}>
                    <Text style={s.alertEventSmall}>{a.event}</Text>
                    <Pill
                      text={a.milesAhead > 0 ? `${a.milesAhead} MI` : 'HERE'}
                      color={colors.amber}
                      bg={colors.amberDim}
                    />
                  </View>
                  <Dim>{a.headline}</Dim>
                </Card>
              ))}
            </Section>
          ) : null}

          {alerts.length === 0 && !checking ? (
            <Card>
              <Body>Nothing active on your position or the road ahead.</Body>
              <Dim>Checked against the National Weather Service. Next check in five minutes.</Dim>
            </Card>
          ) : null}

          <Button title="Check now" variant="secondary" onPress={poll} />
          <Button title="Stop watching" variant="ghost" onPress={stop} />
        </>
      )}

      {!brief ? (
        <Card>
          <Dim>
            No trip loaded, so this checks your current position only. Generate a brief first and it
            will also watch the road ahead of you.
          </Dim>
        </Card>
      ) : null}

      <Button title="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { ...type.hero, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  status: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  alertEvent: { ...type.h2, color: colors.text, flex: 1 },
  alertEventSmall: { ...type.h3, color: colors.text, flex: 1 },
});
