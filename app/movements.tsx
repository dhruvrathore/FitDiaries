import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createMobilityItem,
  deleteMobilityItem,
  listMobilityItemsAll,
  mobilityItemUsage,
  updateMobilityItem,
  type MobilityItemRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Body, Button, Card, Caption, Chip, H3, Loading, Row, Screen } from '@/components/ui';
import { CuesField } from '@/components/CuesField';
import { captureImageFile, deleteImageFile, pickImageFile } from '@/lib/photos';
import { font, radius, spacing, useTheme } from '@/theme/theme';

type Kind = 'warmup' | 'cooldown';
const IMG_DIR = 'mobility-images';

export const BODY_PARTS = [
  'Hips / glutes',
  'T-spine',
  'Shoulders',
  'Chest',
  'Lats',
  'Hamstrings',
  'Quads',
  'Ankles',
  'Neck',
  'Wrists / forearms',
  'Core',
  'Full body',
];

export default function Movements() {
  const { colors } = useTheme();
  const { data } = useQuery(() => listMobilityItemsAll(), []);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingKind, setCreatingKind] = useState<Kind | null>(null);

  if (!data) return <Loading />;

  const editing = editingId != null ? data.find((m) => m.id === editingId) ?? null : null;
  const warmup = data.filter((m) => m.kind === 'warmup');
  const cooldown = data.filter((m) => m.kind === 'cooldown');

  const section = (title: string, emoji: string, items: MobilityItemRow[], kind: Kind) => (
    <View style={{ gap: spacing(2) }}>
      <H3>
        {emoji} {title}
      </H3>
      {items.length === 0 ? <Caption>No movements yet.</Caption> : null}
      {items.map((m) => (
        <Card key={m.id} onPress={() => setEditingId(m.id)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '600' }}>{m.name}</Body>
              {m.bodyPart ? <Caption>{m.bodyPart}</Caption> : null}
            </View>
            {m.cues ? <Text style={{ fontSize: 13, marginRight: spacing(1) }}>💡</Text> : null}
            <Text style={{ color: colors.textFaint }}>›</Text>
          </Row>
        </Card>
      ))}
      <Button title="+ New movement" variant="secondary" onPress={() => setCreatingKind(kind)} />
    </View>
  );

  return (
    <>
      <Screen>
        <Caption>Movements available for warm-ups and cool-downs across all your days.</Caption>
        {section('Warm-up', '🔥', warmup, 'warmup')}
        {section('Cool-down', '🧘', cooldown, 'cooldown')}
        <View style={{ height: spacing(6) }} />
      </Screen>

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditingId(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          {editing ? <EditMovement item={editing} onClose={() => setEditingId(null)} /> : null}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={creatingKind != null}
        animationType="slide"
        onRequestClose={() => setCreatingKind(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          {creatingKind ? (
            <CreateMovement kind={creatingKind} onClose={() => setCreatingKind(null)} />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

function EditMovement({ item, onClose }: { item: MobilityItemRow; onClose: () => void }) {
  const { colors } = useTheme();
  const [name, setName] = useState(item.name);
  useEffect(() => setName(item.name), [item.name]);

  const changeImage = () => {
    Alert.alert('Movement image', undefined, [
      {
        text: 'Take photo',
        onPress: async () => {
          const uri = await captureImageFile(IMG_DIR, `mob-${item.id}`);
          if (uri) {
            if (item.imageUri) deleteImageFile(item.imageUri);
            await updateMobilityItem(item.id, { imageUri: uri });
          }
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const uri = await pickImageFile(IMG_DIR, `mob-${item.id}`);
          if (uri) {
            if (item.imageUri) deleteImageFile(item.imageUri);
            await updateMobilityItem(item.id, { imageUri: uri });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeImage = () => {
    if (item.imageUri) deleteImageFile(item.imageUri);
    updateMobilityItem(item.id, { imageUri: null });
  };

  const confirmDelete = async () => {
    const n = await mobilityItemUsage(item.id);
    const msg =
      n > 0
        ? `"${item.name}" is used in ${n} day${n === 1 ? '' : 's'}. Deleting it removes it from those days.`
        : `"${item.name}" will be permanently removed.`;
    Alert.alert('Delete movement?', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (item.imageUri) deleteImageFile(item.imageUri);
          await deleteMobilityItem(item.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: font.h3, fontWeight: '700', color: colors.text }}>Edit movement</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
        </Pressable>
      </Row>

      <Field label="Name">
        <NameInput
          value={name}
          onChangeText={setName}
          onCommit={() => name.trim() && updateMobilityItem(item.id, { name })}
        />
      </Field>

      <Field label="Body part">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) }}>
          {BODY_PARTS.map((b) => (
            <Chip
              key={b}
              label={b}
              selected={item.bodyPart === b}
              onPress={() =>
                updateMobilityItem(item.id, { bodyPart: item.bodyPart === b ? null : b })
              }
            />
          ))}
        </View>
      </Field>

      <Field label="Image">
        {item.imageUri ? (
          <View style={{ gap: spacing(2) }}>
            <Image
              source={{ uri: item.imageUri }}
              style={{ width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.cardAlt }}
              resizeMode="cover"
            />
            <Row style={{ gap: spacing(2) }}>
              <Button title="Change" variant="secondary" small onPress={changeImage} style={{ flex: 1 }} />
              <Button title="Remove" variant="secondary" small onPress={removeImage} style={{ flex: 1 }} />
            </Row>
          </View>
        ) : (
          <Button title="+ Add image" variant="secondary" onPress={changeImage} />
        )}
      </Field>

      <Field label="Form cues">
        <CuesField value={item.cues} onCommit={(v) => updateMobilityItem(item.id, { cues: v })} />
      </Field>

      <Button title="Delete movement" variant="danger" onPress={confirmDelete} />
      <View style={{ height: spacing(6) }} />
    </ScrollView>
  );
}

function CreateMovement({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await createMobilityItem(name, kind);
    onClose();
  };

  return (
    <View style={{ padding: spacing(4), gap: spacing(3), flex: 1 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: font.h3, fontWeight: '700', color: colors.text }}>
          New {kind === 'warmup' ? 'warm-up' : 'cool-down'} movement
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
        </Pressable>
      </Row>
      <Caption>Name</Caption>
      <NameInput value={name} onChangeText={setName} placeholder="e.g. Hip circles" />
      <Caption>You can add a body part, image, and cues after creating it.</Caption>
      <Button title={saving ? 'Creating…' : 'Create'} disabled={!name.trim() || saving} onPress={save} />
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing(1.5) }}>
      <Caption>{label}</Caption>
      {children}
    </View>
  );
}

function NameInput({
  value,
  onChangeText,
  onCommit,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onCommit?: () => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onBlur={onCommit}
      onEndEditing={onCommit}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing(3),
        paddingVertical: spacing(3),
        color: colors.text,
        fontSize: font.body,
        fontWeight: '600',
      }}
    />
  );
}
