import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { font, radius, spacing, useTheme } from '@/theme/theme';

const PHASES = [
  { label: 'Concentric', hint: 'lifting up', emoji: '⬆️' },
  { label: 'Peak', hint: 'pause at the top', emoji: '⏸️' },
  { label: 'Eccentric', hint: 'lowering down', emoji: '⬇️' },
  { label: 'Bottom', hint: 'pause at the bottom', emoji: '⏱️' },
];

/** Parse a tempo string like "3-1-1-0" (or "3·1·1·0") into 4 numbers. */
export function parseTempo(tempo: string | null): number[] | null {
  if (!tempo) return null;
  const parts = tempo.split(/[-·\s]+/).map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return parts;
}

/** An ⓘ button that opens a centered modal explaining a tempo string. */
export function TempoInfo({ tempo }: { tempo: string | null }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const parts = parseTempo(tempo);
  if (!parts) return null;
  const total = parts.reduce((a, b) => a + b, 0);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>i</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing(6),
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing(4),
              gap: spacing(2.5),
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.body }}>
              Tempo {parts.join('·')} — seconds per phase
            </Text>
            {parts.map((n, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: colors.cardAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>{n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '600' }}>
                    {PHASES[i].label}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.tiny }}>
                    {PHASES[i].hint} · {n}s
                  </Text>
                </View>
                <Text style={{ fontSize: 16 }}>{PHASES[i].emoji}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.border, marginTop: 2 }} />
            <Text style={{ color: colors.textMuted, fontSize: font.tiny }}>
              One rep ≈ <Text style={{ color: colors.text, fontWeight: '700' }}>{total}s</Text>
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
