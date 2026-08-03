import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchCities } from '../data/geo';
import type { Place } from '../types';
import { colors, radius, space, type } from './theme';

/**
 * Origin/destination picker.
 *
 * Backed by the offline freight-city list. When a real geocoder is wired in,
 * swap `searchCities` for a debounced autocomplete call — the surface here does
 * not change.
 */
export function PlacePicker({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: Place;
  onChange: (p: Place) => void;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchCities(query, 40), [query]);

  return (
    <>
      <Pressable
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [s.trigger, pressed && { opacity: 0.7 }]}
      >
        <View style={[s.dot, { backgroundColor: accent ?? colors.accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.triggerLabel}>{label.toUpperCase()}</Text>
          <Text style={s.triggerValue}>{value.name}</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={s.close}>
              <Text style={s.closeText}>Done</Text>
            </Pressable>
          </View>

          <TextInput
            style={s.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search city or state"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.accent}
            autoFocus
          />

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {results.map((p) => {
              const selected = p.id === value.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [s.option, selected && s.optionOn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={s.optionText}>{p.name}</Text>
                  {selected ? <Text style={s.optionCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
            {results.length === 0 ? (
              <Text style={s.noResults}>
                No match. The offline city list covers major freight markets — wire a geocoder for
                full address search.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    minHeight: 60,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  triggerLabel: { ...type.tiny, color: colors.textFaint },
  triggerValue: { ...type.h3, color: colors.text, marginTop: 2 },
  chevron: { color: colors.textFaint, fontSize: 26, fontWeight: '300' },

  modal: { flex: 1, backgroundColor: colors.bg, paddingTop: 52 },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  modalTitle: { ...type.h1, color: colors.text, flex: 1 },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  closeText: { ...type.h3, color: colors.accent },

  search: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    minHeight: 48,
    color: colors.text,
    fontSize: 16,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionOn: { backgroundColor: colors.surfaceAlt },
  optionText: { ...type.body, color: colors.text, flex: 1 },
  optionCheck: { color: colors.accent, fontWeight: '900', fontSize: 18 },

  noResults: {
    ...type.small,
    color: colors.textFaint,
    padding: space.xl,
    textAlign: 'center',
    lineHeight: 19,
  },
});
