import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import {
  addTemplateMobility,
  createMobilityItem,
  listMobilityItems,
  removeTemplateMobility,
  reorderTemplateMobility,
  templateMobilityForEdit,
  updateTemplateMobility,
  type MobilityItemRow,
  type TemplateMobilityEditRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Loading } from '@/components/ui';
import { NumberField } from '@/components/NumberField';
import { font, radius, spacing, useTheme } from '@/theme/theme';

type Kind = 'warmup' | 'cooldown';

export default function TemplateMobilityEditor() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; kind: Kind }>();
  const templateId = Number(params.id);
  const kind: Kind = params.kind === 'cooldown' ? 'cooldown' : 'warmup';

  const [pickerOpen, setPickerOpen] = useState(false);
  const [items, setItems] = useState<TemplateMobilityEditRow[]>([]);

  const { data } = useQuery(() => templateMobilityForEdit(templateId, kind), [templateId, kind]);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  if (!data) return <Loading />;

  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const dest = Math.max(0, Math.min(to, items.length - 1));
    // Ignore the library's spurious post-drop event (from=-1), which reverts the move.
    if (from < 0 || from >= items.length || from === dest) return;
    const next = reorderItems(items, from, dest);
    setItems(next);
    reorderTemplateMobility(next.map((m) => m.id)).catch((e) => console.warn('[reorder]', e));
  };

  return (
    <>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <ReorderableList
          data={items}
          onReorder={onReorder}
          keyExtractor={(m, i) => String(m?.id ?? i)}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(2.5) }}
          ListHeaderComponent={
            <Text
              style={{ color: colors.textMuted, fontSize: font.small, marginBottom: spacing(2) }}
            >
              {kind === 'warmup' ? 'Warm-up' : 'Cool-down'} movements. Drag ≡ to reorder. Set target
              reps and an optional hold.
            </Text>
          }
          ListFooterComponent={
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={{
                marginTop: spacing(2.5),
                padding: spacing(3.5),
                borderRadius: radius.md,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.body }}>
                + Add movement
              </Text>
            </Pressable>
          }
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, fontSize: font.small }}>
              Nothing here yet — add a movement below.
            </Text>
          }
          renderItem={({ item }) => (
            <MobilityEditRow item={item} onRemove={() => removeTemplateMobility(item.id)} />
          )}
        />
      </SafeAreaView>

      <MobilityPicker
        visible={pickerOpen}
        kind={kind}
        existingIds={items.map((m) => m.mobilityItemId)}
        onClose={() => setPickerOpen(false)}
        onPick={(mobilityItemId) => addTemplateMobility(templateId, mobilityItemId)}
      />
    </>
  );
}

function MobilityEditRow({
  item,
  onRemove,
}: {
  item: TemplateMobilityEditRow;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const [reps, setReps] = useState(item.targetReps ?? '');
  useEffect(() => setReps(item.targetReps ?? ''), [item.targetReps]);

  return (
    <View
      style={{
        gap: spacing(2),
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing(3.5),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) }}>
        <Pressable onPressIn={drag} hitSlop={10}>
          <Text style={{ color: colors.textFaint, fontSize: 20 }}>≡</Text>
        </Pressable>
        <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: font.body }}>
          {item.name}
        </Text>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Text style={{ color: colors.textFaint, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing(3), alignItems: 'flex-end' }}>
        <View style={{ flex: 1.4, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: font.tiny, textAlign: 'center' }}>
            target reps
          </Text>
          <TextInput
            value={reps}
            onChangeText={setReps}
            onBlur={() => updateTemplateMobility(item.id, { targetReps: reps.trim() || null })}
            onEndEditing={() => updateTemplateMobility(item.id, { targetReps: reps.trim() || null })}
            placeholder="e.g. 10"
            placeholderTextColor={colors.textFaint}
            style={{
              backgroundColor: colors.cardAlt,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing(2),
              paddingHorizontal: spacing(2),
              color: colors.text,
              fontSize: font.body,
              fontWeight: '700',
              textAlign: 'center',
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="hold (s)"
            value={item.holdSeconds}
            step={5}
            onCommit={(v) => updateTemplateMobility(item.id, { holdSeconds: v })}
          />
        </View>
      </View>
    </View>
  );
}

function MobilityPicker({
  visible,
  kind,
  existingIds,
  onClose,
  onPick,
}: {
  visible: boolean;
  kind: Kind;
  existingIds: number[];
  onClose: () => void;
  onPick: (mobilityItemId: number) => void;
}) {
  const { colors } = useTheme();
  const { data } = useQuery(() => listMobilityItems(kind), [kind]);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const all = (data ?? []).filter((m) => !existingIds.includes(m.id));
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((m) => m.name.toLowerCase().includes(needle));
  }, [data, q, existingIds]);

  const exactMatch = (data ?? []).some((m) => m.name.toLowerCase() === q.trim().toLowerCase());

  const pick = (m: MobilityItemRow) => {
    onPick(m.id);
    setQ('');
    onClose();
  };

  const createAndPick = async () => {
    const id = await createMobilityItem(q.trim(), kind);
    onPick(id);
    setQ('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing(4), gap: spacing(3), flex: 1 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: font.h2, fontWeight: '700', color: colors.text }}>
              Add movement
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
            placeholder="Search or type a new movement…"
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

          {q.trim() && !exactMatch ? (
            <Pressable
              onPress={createAndPick}
              style={{
                backgroundColor: colors.cardAlt,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.primary,
                padding: spacing(3),
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.body }}>
                + Create “{q.trim()}”
              </Text>
            </Pressable>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(m) => String(m.id)}
            ItemSeparatorComponent={() => <View style={{ height: spacing(2) }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
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
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
