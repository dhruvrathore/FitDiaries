import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  addTemplateWarmup,
  getTemplateExerciseConfig,
  listTemplateWarmups,
  removeTemplateWarmup,
  setTemplateExerciseConfig,
  updateTemplateWarmup,
  type TemplateWarmupRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Body, Button, Caption, Card, H3, Loading, Row, Screen } from '@/components/ui';
import { NumberField } from '@/components/NumberField';
import { TempoInfo, parseTempo } from '@/components/TempoInfo';
import { font, radius, spacing, useTheme } from '@/theme/theme';

export default function TemplateExerciseConfigScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teId = Number(id);

  const { data: cfg } = useQuery(() => getTemplateExerciseConfig(teId), [teId]);
  const { data: warmups } = useQuery(() => listTemplateWarmups(teId), [teId]);

  if (!cfg || !warmups) return <Loading />;

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <H3>{cfg.exerciseName}</H3>
        <Caption>
          {cfg.templateName}
          {cfg.muscle ? ` · ${cfg.muscle}` : ''}
        </Caption>
      </View>

      <Row style={{ gap: spacing(3) }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="working sets"
            value={cfg.targetSets}
            min={0}
            onCommit={(v) => setTemplateExerciseConfig(teId, { targetSets: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="rest (sec)"
            value={cfg.restSeconds}
            step={15}
            min={0}
            onCommit={(v) => setTemplateExerciseConfig(teId, { restSeconds: v })}
          />
          <Caption style={{ textAlign: 'center', marginTop: 2 }}>blank = default</Caption>
        </View>
      </Row>

      <TempoEditor
        tempo={cfg.tempo}
        onCommit={(t) => setTemplateExerciseConfig(teId, { tempo: t })}
      />

      <Card>
        <H3>Warm-up sets</H3>
        <Caption>Before your working sets. % is of last week&apos;s top working set.</Caption>
        {warmups.length === 0 ? <Caption>None yet.</Caption> : null}
        {warmups.map((w) => (
          <WarmupRow key={w.id} row={w} />
        ))}
        <Button
          title="+ Add warm-up set"
          variant="secondary"
          onPress={() => addTemplateWarmup(teId, { percent: 50, reps: 10 })}
        />
      </Card>
      <View style={{ height: spacing(6) }} />
    </Screen>
  );
}

// --- tempo: four digit inputs + info popover -------------------------------
function TempoEditor({
  tempo,
  onCommit,
}: {
  tempo: string | null;
  onCommit: (t: string | null) => void;
}) {
  const { colors } = useTheme();
  const initial = parseTempo(tempo);
  const [digits, setDigits] = useState<string[]>(
    initial ? initial.map(String) : ['', '', '', '']
  );
  useEffect(() => {
    const p = parseTempo(tempo);
    setDigits(p ? p.map(String) : ['', '', '', '']);
  }, [tempo]);

  const labels = ['concentric', 'peak', 'eccentric', 'bottom'];

  const commit = (next: string[]) => {
    if (next.every((d) => d.trim() === '')) return onCommit(null);
    const filled = next.map((d) => (d.trim() === '' ? '0' : String(parseInt(d, 10) || 0)));
    onCommit(filled.join('-'));
  };

  return (
    <View style={{ gap: spacing(2) }}>
      <Row style={{ gap: spacing(2) }}>
        <Caption>Tempo (seconds per phase)</Caption>
        <TempoInfo tempo={digits.every((d) => d !== '') ? digits.join('-') : '1-0-1-0'} />
      </Row>
      <Row style={{ gap: spacing(2) }}>
        {digits.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <TextInput
              value={d}
              onChangeText={(t) => {
                const next = [...digits];
                next[i] = t.replace(/[^0-9]/g, '').slice(0, 2);
                setDigits(next);
              }}
              onBlur={() => commit(digits)}
              keyboardType="number-pad"
              placeholder="–"
              placeholderTextColor={colors.textFaint}
              style={{
                width: '100%',
                textAlign: 'center',
                backgroundColor: colors.cardAlt,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingVertical: spacing(2.5),
                color: colors.text,
                fontSize: 22,
                fontWeight: '800',
              }}
            />
            <Text style={{ color: colors.textFaint, fontSize: font.tiny }}>{labels[i]}</Text>
          </View>
        ))}
      </Row>
    </View>
  );
}

// --- one warm-up set row ----------------------------------------------------
function WarmupRow({ row }: { row: TemplateWarmupRow }) {
  const { colors } = useTheme();
  const isPercent = row.percent != null || row.fixedWeight == null;
  const value = isPercent ? row.percent : row.fixedWeight;

  const setType = (percent: boolean) => {
    if (percent) updateTemplateWarmup(row.id, { percent: value ?? 50, fixedWeight: null });
    else updateTemplateWarmup(row.id, { fixedWeight: value ?? 20, percent: null });
  };

  return (
    <View
      style={{
        gap: spacing(2),
        backgroundColor: colors.cardAlt,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing(3),
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: spacing(1.5) }}>
          <TypeChip label="%" active={isPercent} onPress={() => setType(true)} />
          <TypeChip label="kg" active={!isPercent} onPress={() => setType(false)} />
        </Row>
        <Pressable onPress={() => removeTemplateWarmup(row.id)} hitSlop={8}>
          <Text style={{ color: colors.textFaint, fontSize: 16 }}>✕</Text>
        </Pressable>
      </Row>
      <Row style={{ gap: spacing(3) }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label={isPercent ? '% of top set' : 'weight (kg)'}
            value={value}
            step={isPercent ? 5 : 2.5}
            allowDecimal={!isPercent}
            min={0}
            onCommit={(v) =>
              isPercent
                ? updateTemplateWarmup(row.id, { percent: v, fixedWeight: null })
                : updateTemplateWarmup(row.id, { fixedWeight: v, percent: null })
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="reps"
            value={row.reps}
            min={0}
            onCommit={(v) => updateTemplateWarmup(row.id, { reps: v })}
          />
        </View>
      </Row>
    </View>
  );
}

function TypeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing(1.5),
        paddingHorizontal: spacing(3),
        borderRadius: radius.pill,
        backgroundColor: active ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: font.small }}>
        {label}
      </Text>
    </Pressable>
  );
}
