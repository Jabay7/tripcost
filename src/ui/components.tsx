import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, MAX_CONTENT_WIDTH, radius, space, type } from './theme';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      style={[s.screen, style]}
      contentContainerStyle={s.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  accent,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
}) {
  return (
    <View style={[s.card, accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null, style]}>
      {children}
    </View>
  );
}

export function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Divider() {
  return <View style={s.divider} />;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const Label = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[s.label, style]}>{children}</Text>
);

export const Body = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[s.body, style]}>{children}</Text>
);

export const Dim = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[s.dim, style]}>{children}</Text>
);

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function Row({
  label,
  value,
  sub,
  valueColor,
  bold,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <Text style={[s.rowLabel, bold && { fontWeight: '700', color: colors.text }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={[s.rowValue, valueColor ? { color: valueColor } : null, bold && { fontWeight: '800' }]}>
        {value}
      </Text>
    </View>
  );
}

export function StatTile({
  label,
  value,
  sub,
  color,
  flex = 1,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  flex?: number;
}) {
  return (
    <View style={[s.tile, { flex }]}>
      <Text style={s.tileLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.tileValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={s.tileSub}>{sub}</Text> : null}
    </View>
  );
}

export function TileRow({ children }: { children: React.ReactNode }) {
  return <View style={s.tileRow}>{children}</View>;
}

export function Pill({
  text,
  color = colors.textDim,
  bg = colors.surfaceAlt,
}: {
  text: string;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color }]}>{text}</Text>
    </View>
  );
}

/** Horizontal proportion bar used for cost breakdowns. */
export function Bar({ fraction, color }: { fraction: number; color: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary' ? colors.accent
    : variant === 'danger' ? colors.redDim
    : variant === 'ghost' ? 'transparent'
    : colors.surfaceAlt;
  const fg =
    variant === 'primary' ? '#1B1206'
    : variant === 'danger' ? colors.red
    : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  suffix,
  hint,
  secure,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address';
  suffix?: string;
  hint?: string;
  /** Masks input. Used for passwords, which are never logged or persisted here. */
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'off' | 'email' | 'current-password' | 'new-password' | 'one-time-code';
  autoCorrect?: boolean;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldInputWrap}>
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          keyboardType={keyboardType}
          selectionColor={colors.accent}
          secureTextEntry={secure}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? 'go' : 'default'}
        />
        {suffix ? <Text style={s.fieldSuffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[s.segment, small && s.segmentSmall, active && s.segmentActive]}
          >
            <Text
              style={[s.segmentText, small && { fontSize: 12 }, active && s.segmentTextActive]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={s.toggle}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={[s.toggleBox, value && s.toggleBoxOn]}>
        {value ? <Text style={s.toggleCheck}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

/** Multi-select checkbox row, used for picking trucks out of a fleet. */
export function CheckRow({
  title,
  subtitle,
  checked,
  onToggle,
  right,
}: {
  title: string;
  subtitle?: string;
  checked: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [s.checkRow, checked && s.checkRowOn, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.checkBox, checked && s.checkBoxOn]}>
        {checked ? <Text style={s.toggleCheck}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.checkTitle}>{title}</Text>
        {subtitle ? <Text style={s.checkSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: {
    padding: space.lg,
    paddingBottom: space.xxl * 2,
    gap: space.lg,
    // Centre the column on wide windows instead of stretching to the edges.
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },

  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  sectionTitle: { ...type.tiny, color: colors.accent, textTransform: 'uppercase' },
  sectionSub: { ...type.small, color: colors.textFaint, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },

  label: { ...type.tiny, color: colors.textFaint, textTransform: 'uppercase' },
  body: { ...type.body, color: colors.text, lineHeight: 21 },
  dim: { ...type.small, color: colors.textDim, lineHeight: 19 },

  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space.sm, gap: space.md },
  rowLeft: { flex: 1 },
  rowLabel: { ...type.body, color: colors.textDim },
  rowSub: { ...type.small, color: colors.textFaint, marginTop: 3, lineHeight: 17 },
  rowValue: { ...type.body, color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },

  tileRow: { flexDirection: 'row', gap: space.sm },
  tile: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
    gap: 3,
    minWidth: 0,
  },
  tileLabel: { ...type.tiny, color: colors.textFaint },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  tileSub: { ...type.small, color: colors.textFaint },

  pill: {
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { ...type.tiny },

  barTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill },

  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonText: { ...type.h3 },

  field: { gap: 6 },
  fieldLabel: { ...type.tiny, color: colors.textFaint, textTransform: 'uppercase' },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  fieldInput: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  fieldSuffix: { ...type.small, color: colors.textFaint, marginLeft: space.sm },
  fieldHint: { ...type.small, color: colors.textFaint, lineHeight: 17 },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
  },
  segmentSmall: { minHeight: 34 },
  segmentActive: { backgroundColor: colors.borderBright },
  segmentText: { ...type.small, color: colors.textDim, fontWeight: '700' },
  segmentTextActive: { color: colors.text },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingVertical: space.sm,
  },
  toggleLabel: { ...type.body, color: colors.text, fontWeight: '600' },
  toggleBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleCheck: { color: '#1B1206', fontWeight: '900', fontSize: 16 },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 56,
  },
  checkRowOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkTitle: { ...type.body, color: colors.text, fontWeight: '700' },
  checkSub: { ...type.small, color: colors.textFaint, marginTop: 2 },

  empty: { padding: space.xl, alignItems: 'center', gap: space.sm },
  emptyTitle: { ...type.h2, color: colors.textDim },
  emptyBody: { ...type.small, color: colors.textFaint, textAlign: 'center', lineHeight: 19 },
});
