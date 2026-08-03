import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './components';
import { colors, radius, space, type } from './theme';

/**
 * Catches a render crash so the app shows something useful instead of a blank
 * screen.
 *
 * Without this, one thrown error anywhere in the tree unmounts everything and
 * the driver is left staring at white — with no way back and no idea what
 * happened. That is a bad outcome in an office and a worse one at a truck stop
 * at 0300 with a load to book.
 *
 * The recovery path matters as much as the message. "Try again" re-mounts the
 * subtree, which clears transient failures. The saved fleet and ledger live in
 * AsyncStorage and are untouched by a render crash, so recovery loses nothing.
 */

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Left as a console write on purpose. Wiring a crash reporter means
    // shipping a third-party SDK and a privacy disclosure, which is a decision
    // for whoever ships this, not a default.
    console.error('[TripCost] render error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.title}>Something broke</Text>
          <Text style={s.body}>
            TripCost hit an error and stopped this screen. Your trucks, drivers and ledger are saved
            on the device and were not affected.
          </Text>

          <View style={s.detail}>
            <Text style={s.detailLabel}>WHAT HAPPENED</Text>
            <Text style={s.detailText}>{error.message || String(error)}</Text>
          </View>

          <Button title="Try again" onPress={() => this.setState({ error: null })} />

          <Text style={s.hint}>
            If this keeps happening on the same screen, note what you were doing before it broke —
            that is usually enough to find it.
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingTop: space.xxl * 2, gap: space.lg },
  title: { ...type.hero, color: colors.text },
  body: { ...type.body, color: colors.textDim, lineHeight: 22 },
  detail: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  detailLabel: { ...type.tiny, color: colors.textFaint },
  detailText: { ...type.small, color: colors.red, lineHeight: 19 },
  hint: { ...type.small, color: colors.textFaint, lineHeight: 18 },
});
