import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/store/auth';
import { Body, Button, Card, Dim, Field, Label, Screen, Segmented } from '../src/ui/components';
import { colors, space, type } from '../src/ui/theme';

type Kind = 'carrier' | 'driver';

/**
 * Create an account.
 *
 * Two doors, and the difference matters more than it looks:
 *
 *   carrier  creates a brand-new company and becomes its owner.
 *   driver   joins a company that already exists, using a single-use invite
 *            code the carrier gave them.
 *
 * A driver cannot create a company by accident, and nobody can join a carrier
 * without a code that carrier issued. Both paths go through SECURITY DEFINER
 * functions in Postgres, so the client never gets write access it shouldn't
 * have.
 */
export default function SignupScreen() {
  const { signUpCarrier, signUpDriver, busy, backendConfigured } = useAuth();

  const [kind, setKind] = useState<Kind>('carrier');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Enter your email and a password.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters. This account holds your cost basis and rates.');
      return;
    }
    if (kind === 'carrier' && !companyName.trim()) {
      setError('Enter your company name.');
      return;
    }
    if (kind === 'driver' && !inviteCode.trim()) {
      setError('Enter the invite code your carrier sent you.');
      return;
    }

    const result =
      kind === 'carrier'
        ? await signUpCarrier(email, password, companyName)
        : await signUpDriver(email, password, inviteCode);

    if (result.ok) {
      router.replace('/(tabs)');
      return;
    }

    // "Confirm your email" is a success path wearing an error's clothes — the
    // account was made, they just cannot come in yet. Showing it in red would
    // read as a failure and send them round again.
    if (result.error.startsWith('Account created')) {
      setNotice(result.error);
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
        <Text style={s.title}>Create account</Text>
        <Text style={s.sub}>Takes about a minute.</Text>
      </View>

      <Segmented
        value={kind}
        onChange={(v) => {
          setKind(v);
          setError(null);
          setNotice(null);
        }}
        options={[
          { value: 'carrier', label: "I'm the carrier" },
          { value: 'driver', label: "I'm a driver" },
        ]}
      />

      <Card>
        <Dim>
          {kind === 'carrier'
            ? 'Sets up a new company with you as the owner. You add trucks, drivers and costs, and invite your drivers afterwards.'
            : 'Joins a company that already exists. Your carrier sends you a code — you cannot join without one.'}
        </Dim>
      </Card>

      <Card>
        {kind === 'carrier' ? (
          <Field
            label="Company name"
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Bres Transport LLC"
            autoCapitalize="words"
          />
        ) : (
          <Field
            label="Invite code"
            value={inviteCode}
            onChangeText={(v) => setInviteCode(v.toUpperCase())}
            placeholder="ABCD-1234"
            autoCapitalize="characters"
            autoCorrect={false}
            hint="From your dispatcher or owner. Single use, expires in 14 days."
          />
        )}

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
          placeholder="At least 8 characters"
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={submit}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}
        {notice ? <Text style={s.notice}>{notice}</Text> : null}

        <Button
          title={busy ? 'Creating…' : kind === 'carrier' ? 'Create carrier account' : 'Join carrier'}
          onPress={submit}
          disabled={busy}
          style={{ marginTop: space.sm }}
        />
      </Card>

      <Card>
        <Label>Who sees what</Label>
        <Dim>
          Owners see everything: rates, margins, per-truck costs, the ledger. Drivers see their own
          truck, their own loads and their own compliance dates — never costs, never rates, never
          another driver's records. That split is enforced in the database, not just hidden in the
          app.
        </Dim>
      </Card>

      <View style={{ gap: space.sm }}>
        <Button title="I already have an account" variant="secondary" onPress={() => router.replace('/login')} />
        <Button title="Back" variant="ghost" onPress={() => router.replace('/welcome')} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { gap: 4, paddingTop: space.xl },
  title: { ...type.hero, color: colors.text },
  sub: { ...type.body, color: colors.textDim },
  error: { ...type.small, color: colors.red, lineHeight: 18, marginTop: space.xs },
  notice: { ...type.small, color: colors.green, lineHeight: 18, marginTop: space.xs },
});
