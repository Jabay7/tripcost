import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { driverName } from '../src/calc/fleet';
import { CATEGORY_LABELS } from '../src/data/incidents';
import { defaultExtractor, type CapturedDocument } from '../src/services/documents';
import { newId, useStore } from '../src/store/store';
import { makeAddedCost, useTrip } from '../src/store/trip';
import type { ExtractedDocument } from '../src/types';
import {
  Body,
  Button,
  Card,
  Dim,
  Field,
  Label,
  Row,
  Screen,
  Section,
  Pill,
} from '../src/ui/components';
import { colors, radius, shortDate, space, type, usd } from '../src/ui/theme';

/**
 * Photograph a bill, get a report entry.
 *
 * The flow is capture → extract → review → apply, and the review step is not
 * optional. A model reading a crumpled tow bill in bad light will occasionally
 * misread a digit, and a wrong number written silently into the books is worse
 * than no automation at all. Review costs one tap and one glance; it is the
 * difference between a tool a fleet can trust and one it has to audit.
 *
 * Where the entry lands depends on what the paper is. An invoice is money
 * already spent, so it goes to the ledger against a truck. A rate confirmation
 * or BOL describes freight not yet hauled, so it prefills the trip planner
 * instead.
 */

type Stage = 'pick' | 'working' | 'review';

export default function ScanScreen() {
  const { fleet, activeTruckId, addLedgerEntry } = useStore();
  const { patchTrip, addCost } = useTrip();

  const [stage, setStage] = useState<Stage>('pick');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState(activeTruckId ?? fleet.trucks[0]?.id ?? '');

  // Editable copies, so a driver can correct a misread before saving.
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');

  const extractor = defaultExtractor();

  const run = async (doc: CapturedDocument, previewUri: string | null) => {
    setStage('working');
    setError(null);
    setPreview(previewUri);
    try {
      const extracted = await extractor.extract(doc);
      setResult(extracted);
      if (extracted.expense) {
        setAmount(String(extracted.expense.total));
        setVendor(extracted.expense.vendor);
      }
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that document.');
      setStage('pick');
    }
  };

  const readAsDoc = async (uri: string, mediaType: string, filename: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { base64, mediaType, filename };
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera access is needed to photograph a document.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7, // Enough for print; keeps the upload small on cell data.
      allowsEditing: false,
    });
    if (shot.canceled || !shot.assets[0]) return;
    const asset = shot.assets[0];
    const doc = await readAsDoc(asset.uri, asset.mimeType ?? 'image/jpeg', 'photo.jpg');
    await run(doc, asset.uri);
  };

  const pickImage = async () => {
    const shot = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (shot.canceled || !shot.assets[0]) return;
    const asset = shot.assets[0];
    const doc = await readAsDoc(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? 'image.jpg');
    await run(doc, asset.uri);
  };

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const doc = await readAsDoc(
      asset.uri,
      asset.mimeType ?? 'application/pdf',
      asset.name ?? 'document.pdf',
    );
    await run(doc, asset.mimeType?.startsWith('image/') ? asset.uri : null);
  };

  const reset = () => {
    setStage('pick');
    setResult(null);
    setPreview(null);
    setError(null);
  };

  // --- Apply -------------------------------------------------------------
  const saveExpenseToLedger = () => {
    if (!result?.expense || !truckId) return;
    const total = Number(amount) || 0;
    addLedgerEntry({
      id: newId('led'),
      truckId,
      date: result.expense.date || new Date().toISOString(),
      kind: 'expense',
      category: result.expense.category,
      label: vendor || result.expense.vendor || 'Scanned expense',
      amount: total,
      miles: 0,
      note:
        [
          result.expense.invoiceNumber ? `Invoice ${result.expense.invoiceNumber}` : '',
          `Captured from ${result.live ? 'a scanned document' : 'a sample document'}.`,
        ]
          .filter(Boolean)
          .join(' · '),
    });
    router.replace('/(tabs)/ledger');
  };

  const addExpenseToTrip = () => {
    if (!result?.expense) return;
    addCost(
      makeAddedCost({
        label: vendor || result.expense.vendor || 'Scanned expense',
        amount: Number(amount) || 0,
        category: result.expense.category,
        note: result.expense.invoiceNumber ? `Invoice ${result.expense.invoiceNumber}` : '',
        outOfPocket: true,
        reimbursable: result.expense.looksReimbursable,
      }),
    );
    router.replace('/(tabs)');
  };

  const applyLoadToTrip = () => {
    if (!result?.load) return;
    const l = result.load;
    patchTrip({
      ...(l.rate !== null ? { rate: l.rate } : {}),
      ...(l.rateMode !== null ? { rateMode: l.rateMode } : {}),
      ...(l.weightLbs !== null ? { grossWeightLbs: l.weightLbs } : {}),
      ...(l.equipment !== null ? { equipment: l.equipment } : {}),
      ...(l.hazmat !== null ? { hazmat: l.hazmat } : {}),
      ...(l.deliverBy ? { deliverBy: l.deliverBy } : {}),
    });
    router.replace('/(tabs)');
  };

  // --- Render ------------------------------------------------------------

  if (stage === 'working') {
    return (
      <Screen>
        <View style={s.working}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={s.workingText}>Reading the document…</Text>
          <Dim>This takes a few seconds.</Dim>
        </View>
      </Screen>
    );
  }

  if (stage === 'pick') {
    return (
      <Screen>
        <Text style={s.hero}>Scan a document</Text>
        <Dim>
          Tow bill, invoice, fuel receipt, lumper receipt, scale ticket — or a rate confirmation or
          BOL to start a trip from. Photograph it and the numbers come off the page.
        </Dim>

        {error ? (
          <Card accent={colors.red}>
            <Body style={{ color: colors.red }}>{error}</Body>
          </Card>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Button title="📷  Take a photo" onPress={takePhoto} />
          <Button title="🖼  Choose from photos" variant="secondary" onPress={pickImage} />
          <Button title="📄  Choose a PDF" variant="secondary" onPress={pickFile} />
        </View>

        <Card accent={extractor.live ? colors.green : colors.amber}>
          <Label>Extraction</Label>
          <Body>{extractor.name}</Body>
          {!extractor.live ? (
            <Dim>
              No extraction server is configured, so scanning returns a sample document rather than
              reading yours. Start the server in `server/` and set EXPO_PUBLIC_API_BASE to switch
              this on.
            </Dim>
          ) : null}
        </Card>

        <Card>
          <Label>Why you still confirm</Label>
          <Dim>
            Everything scanned lands on a review screen before it touches the books. A photo taken
            at night on the shoulder can turn a 1 into a 7, and a wrong number saved silently is
            worse than no scanning at all. One tap to confirm, and it is in.
          </Dim>
        </Card>
      </Screen>
    );
  }

  // --- Review -------------------------------------------------------------
  if (!result) return null;

  const conf = result.confidence;
  const confColor = conf === 'high' ? colors.green : conf === 'medium' ? colors.amber : colors.red;

  return (
    <Screen>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.kind}>{result.kind.toUpperCase()}</Text>
          <Text style={s.summary}>{result.summary}</Text>
        </View>
        <Pill text={`${conf.toUpperCase()} CONFIDENCE`} color={confColor} bg={colors.surfaceAlt} />
      </View>

      {preview ? <Image source={{ uri: preview }} style={s.preview} resizeMode="cover" /> : null}

      {result.warnings.length > 0 ? (
        <Card accent={colors.amber}>
          <Label>Check these before saving</Label>
          {result.warnings.map((w, i) => (
            <Text key={i} style={s.warn}>
              ⚠ {w}
            </Text>
          ))}
        </Card>
      ) : null}

      {/* --- Expense ---------------------------------------------------- */}
      {result.expense ? (
        <>
          <Section title="What was read" subtitle="Correct anything that came off wrong">
            <Card>
              <Field label="Vendor" value={vendor} onChangeText={setVendor} />
              <Field
                label="Total"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                suffix="$"
                hint="This is the number that hits your books. Check it against the paper."
              />
              <Row label="Category" value={CATEGORY_LABELS[result.expense.category]} />
              {result.expense.date ? (
                <Row label="Date" value={shortDate(result.expense.date)} />
              ) : null}
              {result.expense.invoiceNumber ? (
                <Row label="Invoice #" value={result.expense.invoiceNumber} />
              ) : null}
              {result.expense.gallons !== null ? (
                <Row
                  label="Fuel"
                  value={`${result.expense.gallons} gal`}
                  sub={
                    result.expense.pricePerGallon !== null
                      ? `@ $${result.expense.pricePerGallon.toFixed(3)}/gal`
                      : undefined
                  }
                />
              ) : null}
              {result.expense.looksReimbursable ? (
                <Row label="Reimbursable" value="Likely" valueColor={colors.green} />
              ) : null}
            </Card>
          </Section>

          {result.expense.lineItems.length > 0 ? (
            <Section title="Line items">
              <Card>
                {result.expense.lineItems.map((li, i) => (
                  <Row key={i} label={li.description} value={usd(li.amount)} />
                ))}
              </Card>
            </Section>
          ) : null}

          <Section title="Which truck">
            <View style={s.chips}>
              {fleet.trucks.map((t) => {
                const on = t.id === truckId;
                const seated = fleet.drivers.filter((d) => d.assignedTruckId === t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setTruckId(t.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[s.chip, on && s.chipOn]}
                  >
                    <Text style={[s.chipText, on && { color: colors.text }]}>
                      Unit {t.unitNumber}
                    </Text>
                    {seated.length > 0 ? (
                      <Text style={s.chipSub}>{seated.map(driverName).join(' / ')}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Button title={`Save ${usd(Number(amount) || 0)} to the ledger`} onPress={saveExpenseToLedger} />
          <Button
            title="Add to the trip I'm planning instead"
            variant="secondary"
            onPress={addExpenseToTrip}
          />
        </>
      ) : null}

      {/* --- Load -------------------------------------------------------- */}
      {result.load ? (
        <>
          <Section title="Load details" subtitle="This is freight, not an expense — it prefills a trip">
            <Card>
              <Row
                label="From"
                value={`${result.load.originCity}${result.load.originState ? `, ${result.load.originState}` : ''}`}
              />
              <Row
                label="To"
                value={`${result.load.destinationCity}${result.load.destinationState ? `, ${result.load.destinationState}` : ''}`}
              />
              {result.load.rate !== null ? (
                <Row
                  label="Rate"
                  value={
                    result.load.rateMode === 'per-mile'
                      ? `$${result.load.rate.toFixed(2)}/mi`
                      : usd(result.load.rate)
                  }
                  valueColor={colors.green}
                />
              ) : null}
              {result.load.weightLbs !== null ? (
                <Row label="Weight" value={`${result.load.weightLbs.toLocaleString()} lb`} />
              ) : null}
              {result.load.commodity ? <Row label="Commodity" value={result.load.commodity} /> : null}
              {result.load.equipment ? <Row label="Equipment" value={result.load.equipment} /> : null}
              {result.load.hazmat ? (
                <Row label="Hazmat" value={result.load.hazmat} valueColor={colors.amber} />
              ) : null}
              {result.load.referenceNumber ? (
                <Row label="Reference" value={result.load.referenceNumber} />
              ) : null}
              {result.load.broker ? <Row label="Broker" value={result.load.broker} /> : null}
            </Card>
          </Section>

          <Card>
            <Dim>
              Origin and destination still need picking by hand — the planner works from its own
              city list so the routing and fuel math line up. Everything else transfers.
            </Dim>
          </Card>

          <Button title="Use this for my trip" onPress={applyLoadToTrip} />
        </>
      ) : null}

      {result.kind === 'unknown' ? (
        <Card accent={colors.amber}>
          <Body>
            This did not read as trucking paperwork. Try a straighter shot with the whole page in
            frame, or enter it by hand.
          </Body>
        </Card>
      ) : null}

      <Button title="Scan something else" variant="ghost" onPress={reset} />

      <Card>
        <Row
          label="Source"
          value={result.live ? 'LIVE' : 'SAMPLE'}
          sub={result.provider}
          valueColor={result.live ? colors.green : colors.amber}
        />
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { ...type.hero, color: colors.text },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  kind: { ...type.tiny, color: colors.accent },
  summary: { ...type.h2, color: colors.text, marginTop: 4 },

  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  warn: { ...type.small, color: colors.amber, lineHeight: 18, marginTop: 4 },

  working: { padding: space.xxl, alignItems: 'center', gap: space.md },
  workingText: { ...type.h2, color: colors.text },

  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  chipText: { ...type.small, color: colors.textDim, fontWeight: '700' },
  chipSub: { ...type.tiny, color: colors.textFaint, marginTop: 2 },
});
