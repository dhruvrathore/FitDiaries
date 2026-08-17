import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import {
  createTemplate,
  listTemplatesWithCounts,
  reorderTemplates,
  type TemplateListRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Loading } from '@/components/ui';
import { font, radius, spacing, useTheme } from '@/theme/theme';

export default function TemplatesManager() {
  const { colors } = useTheme();
  const { data } = useQuery(() => listTemplatesWithCounts(), []);
  const [items, setItems] = useState<TemplateListRow[]>([]);

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
    reorderTemplates(next.map((t) => t.id)).catch((e) => console.warn('[reorder]', e));
  };

  const newTemplate = async () => {
    const id = await createTemplate('New day');
    router.push(`/templates/${id}`);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ReorderableList
        data={items}
        onReorder={onReorder}
        keyExtractor={(t, i) => String(t?.id ?? i)}
        contentContainerStyle={{ padding: spacing(4), gap: spacing(2.5) }}
        ListHeaderComponent={
          <Text style={{ color: colors.textMuted, fontSize: font.small, marginBottom: spacing(2) }}>
            Drag ≡ to set the rotation order. Tap a day to edit it.
          </Text>
        }
        ListFooterComponent={
          <Pressable
            onPress={newTemplate}
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
              + New template
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => <TemplateRow item={item} />}
      />
    </SafeAreaView>
  );
}

function TemplateRow({ item }: { item: TemplateListRow }) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  return (
    <Pressable
      onPress={() => router.push(`/templates/${item.id}`)}
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
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.body }}>
          {item.name}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: font.small }}>
          {item.exerciseCount} {item.exerciseCount === 1 ? 'exercise' : 'exercises'}
        </Text>
      </View>
      <Text style={{ color: colors.textFaint, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}
