import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text } from 'react-native';
import { createInvite, listOpenInvites, type OpenInvite } from '../services/invites';
import { useAuth } from '../store/auth';
import { Body, Button, Card, Dim, Label } from './components';
import { colors, radius, shortDate, space, type } from './theme';

/**
 * How a driver gets into the carrier's account.
 *
 * Only rendered for a real signed-in owner. In demo mode there is no company to
 * invite anyone to, and showing a dead button would be worse than showing
 * nothing.
 */
export function InviteCard() {
  const { mode, isOwner } = useAuth();
  const [open, setOpen] = useState<OpenInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listOpenInvites().then(setOpen);
  }, []);

  useEffect(() => {
    if (mode === 'signed-in' && isOwner) refresh();
  }, [mode, isOwner, refresh]);

  if (mode !== 'signed-in' || !isOwner) return null;

  const issue = async () => {
    setBusy(true);
    setError(null);
    const result = await createInvite();
    setBusy(false);
    if (result.ok) refresh();
    else setError(result.error);
  };

  const send = async (code: string) => {
    try {
      await Share.share({
        title: 'TripCost invite',
        message:
          `Your TripCost invite code: ${code}\n\n` +
          'Open the app, choose "I\'m a driver", and enter this code to join. ' +
          'It works once and expires in 14 days.',
      });
    } catch {
      // Share sheet dismissed. Nothing to recover.
    }
  };

  return (
    <Card>
      <Label>Invite a driver</Label>
      <Body>
        Send the driver a code. They create their own login with it — you never handle their
        password. Each code works once and expires in 14 days.
      </Body>

      {open.map((inv) => (
        <Pressable
          key={inv.id}
          onPress={() => send(inv.code)}
          accessibilityRole="button"
          style={({ pressed }) => [s.codeRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.code}>{inv.code}</Text>
          <Text style={s.codeMeta}>Send · expires {shortDate(inv.expiresAt)}</Text>
        </Pressable>
      ))}

      {open.length === 0 ? <Dim>No unused codes.</Dim> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Button
        title={busy ? 'Generating…' : '+ New invite code'}
        variant="secondary"
        onPress={issue}
        disabled={busy}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  code: { ...type.mono, fontSize: 18, color: colors.accent, letterSpacing: 2, fontWeight: '800' },
  codeMeta: { ...type.small, color: colors.textFaint },
  error: { ...type.small, color: colors.red, lineHeight: 18 },
});
