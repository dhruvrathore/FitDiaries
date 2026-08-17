import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createExercise,
  deleteExercise,
  exerciseSessionCount,
  listExercises,
  listMuscleGroups,
  renameExercise,
  setExerciseActive,
  setExerciseCues,
  setExerciseImage,
  setExerciseMetric,
  setExerciseRest,
  setPrimaryMuscle,
  type ExerciseRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Badge, Body, Button, Card, Caption, Chip, Loading, Row, Screen } from '@/components/ui';
import { CuesField } from '@/components/CuesField';
import { NumberField } from '@/components/NumberField';
import { captureImageFile, deleteImageFile, pickImageFile } from '@/lib/photos';
import { font, radius, spacing, useTheme } from '@/theme/theme';

type Metric = 'weight_reps' | 'cardio';
const IMG_DIR = 'exercise-images';

export default function Exercises() {
  const { colors } = useTheme();
  const { data: exercises } = useQuery(() => listExercises(), []);
  const { data: muscles } = useQuery(() => listMuscleGroups(), []);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  if (!exercises || !muscles) return <Loading />;

  const editing = editingId != null ? exercises.find((e) => e.id === editingId) ?? null : null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(q) || (e.muscle ?? '').toLowerCase().includes(q)
      )
    : exercises;

  return (
    <>
      <Screen>
        <Button title="+ New exercise" variant="secondary" onPress={() => setCreating(true)} />
        <SearchInput value={search} onChangeText={setSearch} />
        <Caption>Tap an exercise to rename it, change its type, muscle, image, or cues.</Caption>
        {filtered.length === 0 && (
          <Caption>No exercises match “{search.trim()}”.</Caption>
        )}
        {filtered.map((e) => {
          const hidden = !e.isActive;
          return (
            <Card key={e.id} onPress={() => setEditingId(e.id)} style={hidden ? { opacity: 0.55 } : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Row style={{ gap: spacing(2) }}>
                    <Body style={{ fontWeight: '700' }}>{e.name}</Body>
                    {hidden && <Badge label="Hidden" color={colors.textMuted} />}
                  </Row>
                  <Caption>
                    {e.muscle ?? 'Unassigned'}
                    {e.metric === 'cardio' ? ' · cardio' : ''}
                  </Caption>
                </View>
                <Text style={{ color: colors.textFaint }}>›</Text>
              </Row>
            </Card>
          );
        })}
        <View style={{ height: spacing(6) }} />
      </Screen>

      {/* Edit existing */}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditingId(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          {editing ? (
            <EditExercise
              exercise={editing}
              muscles={muscles}
              onClose={() => setEditingId(null)}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Create new */}
      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <CreateExercise muscles={muscles} onClose={() => setCreating(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

// --- edit an existing exercise ----------------------------------------------
function EditExercise({
  exercise: e,
  muscles,
  onClose,
}: {
  exercise: ExerciseRow;
  muscles: { id: number; name: string }[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(e.name);
  useEffect(() => setName(e.name), [e.name]);

  const changeImage = () => {
    Alert.alert('Exercise image', undefined, [
      {
        text: 'Take photo',
        onPress: async () => {
          const uri = await captureImageFile(IMG_DIR, `ex-${e.id}`);
          if (uri) {
            if (e.imageUri) deleteImageFile(e.imageUri);
            await setExerciseImage(e.id, uri);
          }
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const uri = await pickImageFile(IMG_DIR, `ex-${e.id}`);
          if (uri) {
            if (e.imageUri) deleteImageFile(e.imageUri);
            await setExerciseImage(e.id, uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeImage = () => {
    if (e.imageUri) deleteImageFile(e.imageUri);
    setExerciseImage(e.id, null);
  };

  const confirmDelete = async () => {
    const n = await exerciseSessionCount(e.id);
    const msg =
      n > 0
        ? `"${e.name}" is used in ${n} logged session${n === 1 ? '' : 's'}. Deleting it also removes those sets from your history. To keep history, hide it instead.`
        : `"${e.name}" will be permanently removed.`;
    Alert.alert('Delete exercise?', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (e.imageUri) deleteImageFile(e.imageUri);
          await deleteExercise(e.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: font.h3, fontWeight: '700', color: colors.text }}>Edit exercise</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
        </Pressable>
      </Row>

      <Field label="Name">
        <NameInput value={name} onChangeText={setName} onCommit={() => name.trim() && renameExercise(e.id, name)} />
      </Field>

      <Field label="Type">
        <Row style={{ gap: spacing(2) }}>
          <Chip
            label="Weight × reps"
            selected={e.metric === 'weight_reps'}
            onPress={() => setExerciseMetric(e.id, 'weight_reps')}
          />
          <Chip
            label="Cardio"
            selected={e.metric === 'cardio'}
            onPress={() => setExerciseMetric(e.id, 'cardio')}
          />
        </Row>
      </Field>

      <Field label="Image">
        {e.imageUri ? (
          <View style={{ gap: spacing(2) }}>
            <Image
              source={{ uri: e.imageUri }}
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

      <Field label="Default rest between sets (seconds)">
        <View style={{ maxWidth: 180 }}>
          <NumberField
            label="seconds"
            value={e.restSeconds}
            step={15}
            min={0}
            onCommit={(v) => setExerciseRest(e.id, v)}
          />
        </View>
        <Caption>Blank uses the app default (90s). A day can override this.</Caption>
      </Field>

      <Field label="Form cues">
        <CuesField value={e.cues} onCommit={(v) => setExerciseCues(e.id, v)} />
      </Field>

      <Field label="Primary muscle group">
        <MusclePicker
          muscles={muscles}
          selectedId={e.muscleGroupId}
          onSelect={(id) => setPrimaryMuscle(e.id, id)}
        />
      </Field>

      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Body>Show in pickers</Body>
          <Caption>Turn off to hide without deleting.</Caption>
        </View>
        <Switch value={!!e.isActive} onValueChange={(v) => setExerciseActive(e.id, v)} />
      </Row>

      <Button title="Delete exercise" variant="danger" onPress={confirmDelete} />
      <View style={{ height: spacing(6) }} />
    </ScrollView>
  );
}

// --- create a new exercise ---------------------------------------------------
function CreateExercise({
  muscles,
  onClose,
}: {
  muscles: { id: number; name: string }[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [metric, setMetric] = useState<Metric>('weight_reps');
  const [muscleId, setMuscleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await createExercise({ name, metric, muscleGroupId: muscleId });
      onClose();
    } catch {
      setSaving(false);
      Alert.alert('Could not create', `An exercise named "${name.trim()}" may already exist.`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: font.h3, fontWeight: '700', color: colors.text }}>New exercise</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
        </Pressable>
      </Row>

      <Field label="Name">
        <NameInput value={name} onChangeText={setName} placeholder="e.g. Cable row" />
      </Field>

      <Field label="Type">
        <Row style={{ gap: spacing(2) }}>
          <Chip label="Weight × reps" selected={metric === 'weight_reps'} onPress={() => setMetric('weight_reps')} />
          <Chip label="Cardio" selected={metric === 'cardio'} onPress={() => setMetric('cardio')} />
        </Row>
      </Field>

      <Field label="Primary muscle group">
        <MusclePicker muscles={muscles} selectedId={muscleId} onSelect={setMuscleId} />
      </Field>

      <Button title={saving ? 'Creating…' : 'Create exercise'} disabled={!name.trim() || saving} onPress={save} />
      <View style={{ height: spacing(6) }} />
    </ScrollView>
  );
}

// --- shared bits -------------------------------------------------------------
function SearchInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (t: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ justifyContent: 'center' }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search exercises"
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing(3),
          paddingRight: value ? spacing(9) : spacing(3),
          paddingVertical: spacing(2.5),
          color: colors.text,
          fontSize: font.body,
        }}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          style={{ position: 'absolute', right: spacing(3) }}
        >
          <Text style={{ color: colors.textFaint, fontSize: 16 }}>✕</Text>
        </Pressable>
      ) : null}
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

function MusclePicker({
  muscles,
  selectedId,
  onSelect,
}: {
  muscles: { id: number; name: string }[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) }}>
      {muscles.map((m) => {
        const active = selectedId === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => onSelect(m.id)}
            style={{
              paddingVertical: spacing(2),
              paddingHorizontal: spacing(3),
              borderRadius: radius.pill,
              backgroundColor: active ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: font.small }}>
              {m.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
