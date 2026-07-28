import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { font, radius, spacing, useTheme } from '@/theme/theme';

/**
 * Form-cue note with "tap to edit". Shows the saved cues as a 💡 note (one cue
 * per line); tapping switches to a multi-line input that commits on blur.
 * Follows NumberField's local-state-synced-to-prop commit pattern.
 */
export function CuesField({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (v: string | null) => void;
}) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? '');

  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  const commit = () => {
    const trimmed = text.trim();
    onCommit(trimmed ? trimmed : null);
    setText(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onEndEditing={commit}
        multiline
        autoFocus
        textAlignVertical="top"
        placeholder="Add form cues, one per line"
        placeholderTextColor={colors.textFaint}
        style={{
          minHeight: 66,
          backgroundColor: colors.cardAlt,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: radius.md,
          padding: spacing(2.5),
          color: colors.text,
          fontSize: font.small,
          lineHeight: 20,
        }}
      />
    );
  }

  if (!value) {
    return (
      <Pressable onPress={() => setEditing(true)} hitSlop={6} style={{ paddingVertical: 2 }}>
        <Text style={{ color: colors.textFaint, fontSize: font.small }}>💡 Add form cues</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => setEditing(true)}
      style={{
        flexDirection: 'row',
        gap: spacing(2),
        backgroundColor: colors.cardAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing(2.5),
      }}
    >
      <Text style={{ fontSize: font.body }}>💡</Text>
      <Text style={{ flex: 1, color: colors.text, fontSize: font.small, lineHeight: 20 }}>
        {value}
      </Text>
    </Pressable>
  );
}
