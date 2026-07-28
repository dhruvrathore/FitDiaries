import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listExercises, type ExerciseRow } from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { font, radius, spacing, useTheme } from '@/theme/theme';

export function ExercisePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: ExerciseRow) => void;
}) {
  const { colors } = useTheme();
  const { data } = useQuery(() => listExercises(), []);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const all = (data ?? []).filter((e) => e.isActive);
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter(
      (e) => e.name.toLowerCase().includes(needle) || e.muscle?.toLowerCase().includes(needle)
    );
  }, [data, q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing(4), gap: spacing(3), flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: font.h2, fontWeight: '700', color: colors.text }}>
              Add exercise
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.body }}>
                Close
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search exercises…"
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing(3),
              paddingVertical: spacing(3),
              color: colors.text,
              fontSize: font.body,
            }}
          />

          <FlatList
            data={filtered}
            keyExtractor={(e) => String(e.id)}
            ItemSeparatorComponent={() => <View style={{ height: spacing(2) }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
                style={({ pressed }) => ({
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing(3),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: font.body }}>
                  {item.name}
                </Text>
                {item.muscle ? (
                  <Text style={{ color: colors.textMuted, fontSize: font.small }}>
                    {item.muscle}
                    {item.metric === 'cardio' ? ' · cardio' : ''}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
