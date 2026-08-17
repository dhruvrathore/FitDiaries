import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { font, radius, spacing, useTheme } from '@/theme/theme';

/**
 * Per-row form-cue editor. Cues are stored as a single newline-joined string
 * (one cue per line) for backwards compatibility, but edited as discrete rows:
 * each add / remove commits immediately via onCommit — no blur-to-save, no
 * hidden "one per line" convention.
 */
export function CuesField({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (v: string | null) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const cues = useMemo(
    () =>
      (value ?? '')
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean),
    [value]
  );

  const commit = (next: string[]) => {
    const joined = next.join('\n');
    onCommit(joined ? joined : null);
  };

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    commit([...cues, v]);
    setDraft('');
  };

  const remove = (index: number) => commit(cues.filter((_, i) => i !== index));

  return (
    <View style={{ gap: spacing(2) }}>
      {cues.length === 0 ? (
        <Text style={{ color: colors.textFaint, fontSize: font.small }}>
          No cues yet — add one below.
        </Text>
      ) : (
        cues.map((cue, i) => (
          <View
            key={`${i}-${cue}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing(2),
              backgroundColor: colors.cardAlt,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing(2.5),
              paddingHorizontal: spacing(2.5),
            }}
          >
            <Text style={{ fontSize: font.body }}>💡</Text>
            <Text style={{ flex: 1, color: colors.text, fontSize: font.small, lineHeight: 20 }}>
              {cue}
            </Text>
            <Pressable onPress={() => remove(i)} hitSlop={8}>
              <Text style={{ color: colors.textFaint, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={{ flexDirection: 'row', gap: spacing(2) }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          // Commit a typed-but-not-added cue if the user taps away, so nothing is lost.
          onBlur={add}
          returnKeyType="done"
          blurOnSubmit={false}
          placeholder="Add a form cue"
          placeholderTextColor={colors.textFaint}
          style={{
            flex: 1,
            backgroundColor: colors.cardAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: spacing(2.5),
            paddingHorizontal: spacing(2.5),
            color: colors.text,
            fontSize: font.small,
          }}
        />
        <Pressable
          onPress={add}
          hitSlop={6}
          style={{
            paddingHorizontal: spacing(3.5),
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: colors.primaryText, fontSize: font.body, fontWeight: '700' }}>
            Add
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
