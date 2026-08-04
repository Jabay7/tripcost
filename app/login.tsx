import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/store/auth';
import { Body, Button, Card, Field, Screen } from '../src/ui/components';
import { colors, space, type } from '../src/ui/theme';

/**
 * Sign in.
 *
 * Deliberately plain — a driver opening this on a phone in a truck stop parking
 * lot wants two fields and a button, not a marketing page. Errors are rendered
 * in words they can act on (see `friendlyAuthError`), never raw Postgres.
 */
export default function LoginScreen() {
  const { signIn, busy, backendConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    const result = await signIn(email, password);
    if (result.ok) {
      router.replace('/(tabs)');
    } else {
      setError(result.error);
    }
  };

  if (!backendConfigured) {
    return (
      <Screen>
        <Card accent={colors.amber}>
          <Body>Accounts are not connected in this build. Go back and use the demo.</Body>
        </Card>
        <Button title="Back" variant="secondary" onPress={() => router.replace('/welcome')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={s.head}>
        <Text style={s.title}>Sign in</Text>
        <Text style={s.sub}>Your carrier's fleet, costs and drivers.</Text>
      </View>

      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@carrier.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          onSubmitEditing={submit}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Button
          title={busy ? 'Signing in…' : 'Sign in'}
          onPress={submit}
          disabled={busy}
          style={{ marginTop: space.sm }}
        />
      </Card>

      <View style={{ gap: space.sm }}>
        <Button
          title="Create a carrier account"
          variant="secondary"
          onPress={() => router.replace('/signup')}
        />
        <Button title="Back" variant="ghost" onPress={() => router.replace('/welcome')} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { gap: 4, paddingTop: space.xl },
  title: { ...type.hero, color: colors.text },
  sub: { ...type.body, color: colors.textDim },
  error: {
    ...type.small,
    color: colors.red,
    lineHeight: 18,
    marginTop: space.xs,
  },
});
