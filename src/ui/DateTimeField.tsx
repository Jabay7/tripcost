import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from './theme';

const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Date and time entry built from steppers rather than a native picker.
 *
 * Deliberate: a driver setting a dispatch time wants coarse, fast adjustment
 * with gloves on, and this renders identically on iOS, Android and web with no
 * native module. Precision below the hour does not matter for trip planning.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
}) {
  const d = new Date(value);
  const shift = (ms: number) => onChange(new Date(d.getTime() + ms).toISOString());

  const snapToNextHour = () => {
    const n = new Date();
    n.setMinutes(0, 0, 0);
    n.setHours(n.getHours() + 1);
    onChange(n.toISOString());
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <View style={s.box}>
        <Text style={s.value}>
          {d.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
        <Pressable onPress={snapToNextHour} accessibilityRole="button" style={s.now}>
          <Text style={s.nowText}>Now</Text>
        </Pressable>
      </View>
      <View style={s.steppers}>
        <Stepper label="Day" onMinus={() => shift(-DAY)} onPlus={() => shift(DAY)} />
        <Stepper label="Hour" onMinus={() => shift(-HOUR)} onPlus={() => shift(HOUR)} />
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={s.stepper}>
      <Pressable
        onPress={onMinus}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={s.stepText}>−</Text>
      </Pressable>
      <Text style={s.stepLabel}>{label}</Text>
      <Pressable
        onPress={onPlus}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={s.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  label: { ...type.tiny, color: colors.textFaint, textTransform: 'uppercase' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: space.md,
    paddingRight: 4,
    minHeight: 48,
  },
  value: { ...type.h3, color: colors.text, flex: 1, fontVariant: ['tabular-nums'] },
  now: { minHeight: 40, paddingHorizontal: space.md, justifyContent: 'center' },
  nowText: { ...type.small, color: colors.accent, fontWeight: '700' },

  steppers: { flexDirection: 'row', gap: space.sm },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: { width: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 24, fontWeight: '700', lineHeight: 28 },
  stepLabel: { ...type.tiny, color: colors.textFaint, flex: 1, textAlign: 'center' },

  hint: { ...type.small, color: colors.textFaint, lineHeight: 17 },
});
