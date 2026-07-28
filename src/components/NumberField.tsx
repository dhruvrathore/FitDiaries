import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { font, radius, spacing, useTheme } from '@/theme/theme';

/**
 * Compact numeric field with +/- steppers and direct entry. Used for weight/reps.
 * Commits changes via onCommit (weight can be fractional; reps whole).
 */
export function NumberField({
  label,
  value,
  onCommit,
  step = 1,
  min = 0,
  allowDecimal = false,
  suffix,
}: {
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  step?: number;
  min?: number;
  allowDecimal?: boolean;
  suffix?: string;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(value?.toString() ?? '');

  useEffect(() => {
    setText(value?.toString() ?? '');
  }, [value]);

  const commitText = (t: string) => {
    const cleaned = t.replace(',', '.');
    if (cleaned === '') return onCommit(null);
    const n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
    if (!Number.isNaN(n)) onCommit(n);
  };

  const bump = (dir: number) => {
    const cur = value ?? 0;
    const next = Math.max(min, +(cur + dir * step).toFixed(2));
    onCommit(next);
  };

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ fontSize: font.tiny, color: colors.textMuted, textAlign: 'center' }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.md,
          backgroundColor: colors.cardAlt,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Stepper label="–" onPress={() => bump(-1)} />
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={() => commitText(text)}
          onBlur={() => commitText(text)}
          keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
          placeholder="–"
          placeholderTextColor={colors.textFaint}
          style={{
            flex: 1,
            textAlign: 'center',
            color: colors.text,
            fontWeight: '700',
            fontSize: font.body,
            paddingVertical: spacing(2),
          }}
        />
        <Stepper label="+" onPress={() => bump(1)} />
      </View>
      {suffix ? (
        <Text style={{ fontSize: font.tiny, color: colors.textFaint, textAlign: 'center' }}>
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{ paddingHorizontal: spacing(3), paddingVertical: spacing(2) }}
    >
      <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
