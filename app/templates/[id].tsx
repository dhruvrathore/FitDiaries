import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import {
  addTemplateExercise,
  deleteTemplate,
  listTemplates,
  removeTemplateExercise,
  renameTemplate,
  reorderTemplateExercises,
  templateExercisesForEdit,
  templateMobilityForEdit,
  type TemplateExerciseEditRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Loading } from '@/components/ui';
import { ExercisePicker } from '@/components/ExercisePicker';
import { font, radius, spacing, useTheme } from '@/theme/theme';

export default function TemplateEditor() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = Number(id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [items, setItems] = useState<TemplateExerciseEditRow[]>([]);

  const { data } = useQuery(async () => {
    const [templates, exercises, warm, cool] = await Promise.all([
      listTemplates(),
      templateExercisesForEdit(templateId),
      templateMobilityForEdit(templateId, 'warmup'),
      templateMobilityForEdit(templateId, 'cooldown'),
    ]);
    const t = templates.find((x) => x.id === templateId) ?? null;
    return { name: t?.name ?? '', exercises, warmCount: warm.length, coolCount: cool.length };
  }, [templateId]);

  useEffect(() => {
    if (data) setItems(data.exercises);
  }, [data]);

  if (!data) return <Loading />;

  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const next = reorderItems(items, from, to);
    setItems(next);
    reorderTemplateExercises(next.map((e) => e.id));
  };

  const confirmDelete = () =>
    Alert.alert('Delete template?', `"${data.name}" and its exercises will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate(templateId);
          router.back();
        },
      },
    ]);

  return (
    <>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <ReorderableList
          data={items}
          onReorder={onReorder}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(2) }}
          ListHeaderComponent={
            <View style={{ gap: spacing(2), marginBottom: spacing(2) }}>
              <Text style={{ color: colors.textFaint, fontSize: font.tiny, letterSpacing: 1 }}>
                TEMPLATE NAME
              </Text>
              <NameField
                value={data.name}
                onCommit={(v) => v && renameTemplate(templateId, v)}
              />
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: font.small,
                  fontWeight: '600',
                  marginTop: spacing(2),
                }}
              >
                Exercises
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={{ gap: spacing(2), marginTop: spacing(2) }}>
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={{
                  padding: spacing(3.5),
                  borderRadius: radius.md,
                  backgroundColor: colors.cardAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.body }}>
                  + Add exercise
                </Text>
              </Pressable>

              <MobilityRow
                emoji="🔥"
                title="Warm-up"
                count={data.warmCount}
                onPress={() => router.push(`/templates/mobility?id=${templateId}&kind=warmup`)}
              />
              <MobilityRow
                emoji="🧘"
                title="Cool-down"
                count={data.coolCount}
                onPress={() => router.push(`/templates/mobility?id=${templateId}&kind=cooldown`)}
              />

              <Pressable
                onPress={confirmDelete}
                style={{ alignItems: 'center', padding: spacing(3), marginTop: spacing(2) }}
              >
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: font.body }}>
                  Delete template
                </Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, fontSize: font.small }}>
              No exercises yet — add one below.
            </Text>
          }
          renderItem={({ item }) => (
            <ExerciseRow item={item} onRemove={() => removeTemplateExercise(item.id)} />
          )}
        />
      </SafeAreaView>

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(ex) => addTemplateExercise(templateId, ex.id)}
      />
    </>
  );
}

function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => onCommit(text.trim())}
      onEndEditing={() => onCommit(text.trim())}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing(3),
        paddingVertical: spacing(3),
        color: colors.text,
        fontSize: font.h3,
        fontWeight: '700',
      }}
    />
  );
}

function ExerciseRow({
  item,
  onRemove,
}: {
  item: TemplateExerciseEditRow;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(2.5),
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing(3.5),
      }}
    >
      <Pressable onPressIn={drag} hitSlop={10}>
        <Text style={{ color: colors.textFaint, fontSize: 20 }}>≡</Text>
      </Pressable>
      <Pressable
        style={{ flex: 1 }}
        onPress={() =>
          router.push(`/templates/exercise?id=${item.id}`)
        }
      >
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: font.body }}>
          {item.name}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: font.small }}>
          {[
            item.muscle,
            item.targetSets != null ? `${item.targetSets} sets` : 'sets —',
            item.tempo ? `tempo ${item.tempo}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Pressable>
      <Text style={{ color: colors.textFaint, fontSize: 18 }}>›</Text>
      <Pressable onPress={onRemove} hitSlop={10}>
        <Text style={{ color: colors.textFaint, fontSize: 16 }}>✕</Text>
      </Pressable>
    </View>
  );
}

function MobilityRow({
  emoji,
  title,
  count,
  onPress,
}: {
  emoji: string;
  title: string;
  count: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing(3.5),
      }}
    >
      <Text style={{ color: colors.text, fontSize: font.body }}>
        {emoji} {title}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: font.small }}>
        {count} {count === 1 ? 'item' : 'items'} ›
      </Text>
    </Pressable>
  );
}
