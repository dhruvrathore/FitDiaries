import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  addExerciseToSession,
  addSet,
  deleteSet,
  deleteSession,
  finishSession,
  getSessionExercises,
  getSessionHeader,
  getSessionMobility,
  getSettings,
  lastSessionSets,
  listTemplateWarmups,
  removeSessionExercise,
  setExerciseCues,
  setSessionPhase,
  toggleMobility,
  updateMobilityItem,
  updateSet,
  allSetsForExercise,
  type HistorySet,
  type LastSession,
  type SessionExerciseDetail,
  type SessionMobilityRow,
  type SessionSet,
  type TemplateWarmupRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import {
  Badge,
  Body,
  Button,
  Card,
  Caption,
  Divider,
  H2,
  H3,
  Loading,
  Row,
  Screen,
} from '@/components/ui';
import { HoldTimer } from '@/components/HoldTimer';
import { RestOverlay } from '@/components/RestOverlay';
import { WarmupGuide } from '@/components/WarmupGuide';
import { CuesField } from '@/components/CuesField';
import { TempoInfo } from '@/components/TempoInfo';
import { ExercisePicker } from '@/components/ExercisePicker';
import { useRestStore } from '@/store/rest';
import { detectPRs } from '@/lib/metrics';
import { setLabel } from '@/lib/format';
import { PHASES, font, phaseColor, phaseLabel, radius, spacing, useTheme, type Phase } from '@/theme/theme';

export default function ActiveSession() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [step, setStep] = useState<'warmup' | 'train' | 'cooldown'>('warmup');

  const { data } = useQuery(async () => {
    const header = await getSessionHeader(sessionId);
    if (!header) return null;
    const [exercises, mobility, settings] = await Promise.all([
      getSessionExercises(sessionId, header.templateId),
      getSessionMobility(sessionId, header.templateId),
      getSettings(),
    ]);
    const historyEntries = await Promise.all(
      exercises.map(async (e) => [e.exerciseId, await allSetsForExercise(e.exerciseId)] as const)
    );
    const lastEntries = await Promise.all(
      exercises.map(
        async (e) => [e.exerciseId, await lastSessionSets(e.exerciseId, sessionId)] as const
      )
    );
    const warmupEntries = await Promise.all(
      exercises.map(
        async (e) =>
          [
            e.exerciseId,
            e.templateExerciseId != null ? await listTemplateWarmups(e.templateExerciseId) : [],
          ] as const
      )
    );
    return {
      header,
      exercises,
      warmup: mobility.filter((m) => m.kind === 'warmup'),
      cooldown: mobility.filter((m) => m.kind === 'cooldown'),
      settings,
      history: Object.fromEntries(historyEntries) as Record<number, HistorySet[]>,
      last: Object.fromEntries(lastEntries) as Record<number, LastSession>,
      warmupPlans: Object.fromEntries(warmupEntries) as Record<number, TemplateWarmupRow[]>,
    };
  }, [sessionId]);

  if (data === undefined) return <Loading />;
  if (data === null)
    return (
      <Screen>
        <Body>Session not found.</Body>
      </Screen>
    );

  const { header, exercises, warmup, cooldown, settings, history, last, warmupPlans } = data;
  const restSeconds = settings?.restSeconds ?? 90;
  const soundEnabled = !!settings?.restSoundEnabled;

  const startRest = (label?: string, secs?: number | null) =>
    useRestStore.getState().start(secs ?? restSeconds, soundEnabled, label);

  const confirmFinish = () => {
    Alert.alert('Finish workout?', 'Your session will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          await finishSession(sessionId);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const confirmDiscard = () => {
    Alert.alert('Discard workout?', 'This session will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(sessionId);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const focused =
    focusIndex != null && focusIndex >= 0 && focusIndex < exercises.length
      ? exercises[focusIndex]
      : null;

  return (
    <>
      {focused ? (
        // --- Focus: one exercise at a time -------------------------------
        <Screen contentStyle={{ paddingBottom: spacing(40) }}>
          <FocusHeader
            dayName={header.dayName}
            index={focusIndex as number}
            exercises={exercises}
            onBack={() => setFocusIndex(null)}
          />
          <ExerciseCard
            se={focused}
            history={history[focused.exerciseId] ?? []}
            last={last[focused.exerciseId] ?? { at: null, sets: [] }}
            warmups={warmupPlans[focused.exerciseId] ?? []}
            startedAt={header.startedAt}
            onLogSet={startRest}
            onRemove={() =>
              Alert.alert('Remove exercise?', focused.name, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    await removeSessionExercise(focused.sessionExerciseId);
                    setFocusIndex(null);
                  },
                },
              ])
            }
          />
          <Row style={{ gap: spacing(3) }}>
            <View style={{ flex: 1 }}>
              <Button
                title="‹ Prev"
                variant="secondary"
                disabled={(focusIndex as number) === 0}
                onPress={() => setFocusIndex((i) => Math.max(0, (i ?? 0) - 1))}
              />
            </View>
            <View style={{ flex: 2 }}>
              {(focusIndex as number) < exercises.length - 1 ? (
                <Button
                  title="Next exercise ›"
                  onPress={() =>
                    setFocusIndex((i) => Math.min(exercises.length - 1, (i ?? 0) + 1))
                  }
                />
              ) : (
                <Button title="Done — back to overview" onPress={() => setFocusIndex(null)} />
              )}
            </View>
          </Row>
        </Screen>
      ) : (
        // --- Guided flow: warm-up → train → cool-down --------------------
        <Screen contentStyle={{ paddingBottom: spacing(40) }}>
          <H2>{header.dayName}</H2>
          <StepBar
            step={step}
            warmupDone={warmup.length > 0 && warmup.every((i) => i.checked)}
            cooldownDone={cooldown.length > 0 && cooldown.every((i) => i.checked)}
            onSelect={setStep}
          />

          {step === 'warmup' &&
            (warmup.length > 0 ? (
              <WarmupGuide
                warmup={warmup}
                sessionId={sessionId}
                onDone={() => setStep('train')}
              />
            ) : (
              <>
                <Caption>No warm-up for this day.</Caption>
                <Button title="Start training ›" onPress={() => setStep('train')} />
              </>
            ))}

          {step === 'train' && (
            <>
              <Row style={{ flexWrap: 'wrap', gap: spacing(2) }}>
                {PHASES.map((p) => (
                  <PhasePill
                    key={p}
                    phase={p}
                    active={header.phase === p}
                    onPress={() => setSessionPhase(sessionId, p)}
                  />
                ))}
              </Row>

              <H3>Exercises</H3>
              {exercises.map((se, i) => (
                <ExerciseRow key={se.sessionExerciseId} se={se} onPress={() => setFocusIndex(i)} />
              ))}

              <Button
                title="+ Add exercise"
                variant="secondary"
                onPress={() => setPickerOpen(true)}
              />

              <Divider />
              <Button title="Go to cool-down ›" onPress={() => setStep('cooldown')} />
            </>
          )}

          {step === 'cooldown' && (
            <>
              {cooldown.length > 0 ? (
                <ChecklistSection
                  title="Cool-down"
                  emoji="🧘"
                  items={cooldown}
                  sessionId={sessionId}
                />
              ) : (
                <Caption>No cool-down for this day.</Caption>
              )}
              <Divider />
              <Button title="Finish workout" onPress={confirmFinish} />
              <Pressable
                onPress={confirmDiscard}
                style={{ alignItems: 'center', padding: spacing(2) }}
              >
                <Text style={{ color: colors.danger, fontWeight: '600' }}>Discard</Text>
              </Pressable>
            </>
          )}
        </Screen>
      )}

      <RestOverlay />

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(ex) => addExerciseToSession(sessionId, ex.id)}
      />
    </>
  );
}

// --- overview row ------------------------------------------------------------
function ExerciseRow({ se, onPress }: { se: SessionExerciseDetail; onPress: () => void }) {
  const { colors } = useTheme();
  const logged = se.sets.filter((s) =>
    se.metric === 'cardio' ? s.durationSec != null || s.distanceM != null : s.reps != null
  ).length;
  const setsLabel = se.sets.length > 0 ? `${logged}/${se.sets.length} sets` : 'No sets yet';
  return (
    <Card onPress={onPress}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700', fontSize: 16 }}>{se.name}</Body>
          <Caption>{se.muscle ? `${se.muscle} · ${setsLabel}` : setsLabel}</Caption>
        </View>
        {se.cues ? <Text style={{ fontSize: 14, marginRight: spacing(1) }}>💡</Text> : null}
        <Text style={{ color: colors.textFaint, fontSize: 18 }}>›</Text>
      </Row>
    </Card>
  );
}

// --- focus header ------------------------------------------------------------
function FocusHeader({
  dayName,
  index,
  exercises,
  onBack,
}: {
  dayName: string;
  index: number;
  exercises: SessionExerciseDetail[];
  onBack: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing(2) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>‹ Overview</Text>
        </Pressable>
        <Caption>
          {dayName} · Exercise {index + 1} of {exercises.length}
        </Caption>
      </Row>
      <Row style={{ gap: 4 }}>
        {exercises.map((se, i) => {
          const done = se.sets.some((s) =>
            se.metric === 'cardio'
              ? s.durationSec != null || s.distanceM != null
              : s.reps != null
          );
          const color = i === index ? colors.primary : done ? colors.success : colors.border;
          return (
            <View
              key={se.sessionExerciseId}
              style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: color }}
            />
          );
        })}
      </Row>
    </View>
  );
}

// --- guided step bar ---------------------------------------------------------
type Step = 'warmup' | 'train' | 'cooldown';

function StepBar({
  step,
  warmupDone,
  cooldownDone,
  onSelect,
}: {
  step: Step;
  warmupDone: boolean;
  cooldownDone: boolean;
  onSelect: (s: Step) => void;
}) {
  const segments: { key: Step; label: string; done: boolean }[] = [
    { key: 'warmup', label: '🔥 Warm-up', done: warmupDone },
    { key: 'train', label: '🏋 Train', done: false },
    { key: 'cooldown', label: '🧘 Cool-down', done: cooldownDone },
  ];
  return (
    <Row style={{ gap: spacing(1.5) }}>
      {segments.map((s) => (
        <StepSegment
          key={s.key}
          label={s.label}
          active={step === s.key}
          done={s.done && step !== s.key}
          onPress={() => onSelect(s.key)}
        />
      ))}
    </Row>
  );
}

function StepSegment({
  label,
  active,
  done,
  onPress,
}: {
  label: string;
  active: boolean;
  done: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const bg = active ? colors.primary : colors.cardAlt;
  const fg = active ? '#fff' : done ? colors.success : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing(2.5),
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
        {label}
        {done ? ' ✓' : ''}
      </Text>
    </Pressable>
  );
}

// --- phase pill --------------------------------------------------------------
function PhasePill({
  phase,
  active,
  onPress,
}: {
  phase: Phase;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const c = phaseColor[phase];
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing(1.5),
        paddingHorizontal: spacing(3),
        borderRadius: radius.pill,
        backgroundColor: active ? c : colors.cardAlt,
        borderWidth: 1,
        borderColor: active ? c : colors.border,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.textMuted, fontWeight: '600', fontSize: 13 }}>
        {phaseLabel[phase]}
      </Text>
    </Pressable>
  );
}

// --- checklist ---------------------------------------------------------------
function ChecklistSection({
  title,
  emoji,
  items,
  sessionId,
}: {
  title: string;
  emoji: string;
  items: SessionMobilityRow[];
  sessionId: number;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H3>
          {emoji} {title}
        </H3>
        <Caption>
          {items.filter((i) => i.checked).length}/{items.length}
        </Caption>
      </Row>
      <View style={{ gap: spacing(2) }}>
        {items.map((item) => (
          <View key={item.mobilityItemId} style={{ gap: spacing(1.5) }}>
            <Pressable
              onPress={() => toggleMobility(sessionId, item.mobilityItemId, !item.checked)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing(2.5),
                paddingVertical: spacing(1.5),
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: item.checked ? colors.success : colors.border,
                  backgroundColor: item.checked ? colors.success : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.checked && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}
              </View>
              {item.imageUri ? (
                <Image
                  source={{ uri: item.imageUri }}
                  style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.cardAlt }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: item.checked ? colors.textMuted : colors.text,
                    fontWeight: '600',
                    textDecorationLine: item.checked ? 'line-through' : 'none',
                  }}
                >
                  {item.name}
                </Text>
                <Row style={{ gap: spacing(2) }}>
                  {item.bodyPart ? (
                    <Text
                      style={{
                        color: colors.accent,
                        fontSize: font.tiny,
                        fontWeight: '700',
                        letterSpacing: 0.3,
                      }}
                    >
                      {item.bodyPart.toUpperCase()}
                    </Text>
                  ) : null}
                  {item.targetReps ? <Caption>{item.targetReps}</Caption> : null}
                </Row>
              </View>
              {item.holdSeconds ? (
                <HoldTimer
                  seconds={item.holdSeconds}
                  onComplete={() =>
                    !item.checked && toggleMobility(sessionId, item.mobilityItemId, true)
                  }
                />
              ) : null}
            </Pressable>
            <View style={{ marginLeft: spacing(8) }}>
              <CuesField
                value={item.cues}
                onCommit={(v) => updateMobilityItem(item.mobilityItemId, { cues: v })}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

// --- exercise card -----------------------------------------------------------
const roundHalf = (x: number) => Math.round(x * 2) / 2;

function ExerciseCard({
  se,
  history,
  last,
  warmups,
  startedAt,
  onLogSet,
  onRemove,
}: {
  se: SessionExerciseDetail;
  history: HistorySet[];
  last: LastSession;
  warmups: TemplateWarmupRow[];
  startedAt: number;
  onLogSet: (label: string, restSeconds?: number | null) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const isCardio = se.metric === 'cardio';

  const loggedWork = se.sets.filter((s) => !s.isWarmup);
  const loggedWarm = se.sets.filter((s) => s.isWarmup);

  // Base weight for % warm-ups: prompted → today's top working → last session's top working.
  const [promptedBase, setPromptedBase] = useState<number | null>(null);
  const [baseInput, setBaseInput] = useState<number | null>(null);
  const topToday = loggedWork.reduce((m, s) => Math.max(m, s.weight ?? 0), 0) || null;
  const topLast = last.sets.reduce((m, s) => Math.max(m, s.weight ?? 0), 0) || null;
  const base = promptedBase ?? topToday ?? topLast ?? null;
  const hasPercentWarmup = warmups.some((w) => w.percent != null);
  const needBase = !isCardio && hasPercentWarmup && base == null && loggedWarm.length === 0;

  const warmupWeight = (w: TemplateWarmupRow): number | null => {
    if (w.fixedWeight != null) return w.fixedWeight;
    if (w.percent != null && base != null) return roundHalf((w.percent / 100) * base);
    return null;
  };

  // PR flags for a given set vs everything that happened before it (working sets only).
  const prFor = (setNumber: number, weight: number | null, reps: number | null) => {
    const prior = history
      .filter((h) => h.at < startedAt || (h.at === startedAt && h.setNumber < setNumber))
      .map((h) => ({ weight: h.weight, reps: h.reps }));
    return detectPRs(prior, { weight, reps });
  };

  // Active working-set draft.
  const setToDraft = (s: SessionSet) =>
    isCardio
      ? { a: s.durationSec != null ? Math.round(s.durationSec / 60) : null, b: s.distanceM }
      : { a: s.weight, b: s.reps };
  const prefillNew = () => {
    const prev = loggedWork[loggedWork.length - 1];
    if (prev) return setToDraft(prev);
    const ls = last.sets[last.sets.length - 1];
    return isCardio ? { a: null, b: null } : { a: ls?.weight ?? null, b: ls?.reps ?? null };
  };

  const [draftA, setDraftA] = useState<number | null>(() => prefillNew().a);
  const [draftB, setDraftB] = useState<number | null>(() => prefillNew().b);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);

  const editRow = (s: SessionSet) => {
    const d = setToDraft(s);
    setDraftA(d.a);
    setDraftB(d.b);
    setEditingSetId(s.id);
  };
  const resetToNew = () => {
    const d = prefillNew();
    setDraftA(d.a);
    setDraftB(d.b);
    setEditingSetId(null);
  };
  const payload = () =>
    isCardio
      ? { durationSec: draftA != null ? Math.round(draftA * 60) : null, distanceM: draftB }
      : { weight: draftA, reps: draftB };

  const logNew = async () => {
    const next = loggedWork.length + 2; // set the user does after this rest
    const total = se.targetSets ?? null;
    const hasNext = total == null || next <= total;
    await addSet(se.sessionExerciseId, payload());
    onLogSet(hasNext ? `${se.name} · set ${next}` : `${se.name} · last set done`, se.restSeconds);
  };
  const saveEdit = async () => {
    if (editingSetId == null) return;
    await updateSet(editingSetId, payload());
    resetToNew();
  };
  const logWarmup = async (w: TemplateWarmupRow, i: number) => {
    await addSet(se.sessionExerciseId, {
      weight: warmupWeight(w),
      reps: w.reps ?? null,
      isWarmup: true,
    });
    onLogSet(`${se.name} · warm-up ${i + 1}`, se.restSeconds);
  };

  const editingSet = editingSetId != null ? se.sets.find((s) => s.id === editingSetId) : null;
  const workingNext = loggedWork.length + 1;
  const targetSets = se.targetSets ?? null;
  const remainingWorking =
    targetSets != null ? Math.max(0, targetSets - loggedWork.length) : 0;
  const restLabel =
    se.restSeconds != null ? `rest ${Math.round(se.restSeconds / 60)}:${String(se.restSeconds % 60).padStart(2, '0')}` : null;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: spacing(3) }}>
        {se.imageUri ? (
          <Image
            source={{ uri: se.imageUri }}
            style={{ width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.cardAlt }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: radius.md,
              backgroundColor: colors.cardAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 26 }}>🏋</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22, lineHeight: 26 }}>
            {se.name}
          </Text>
          <Row style={{ gap: spacing(2), flexWrap: 'wrap' }}>
            {se.muscle ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {se.muscle}
              </Text>
            ) : null}
            {se.tempo ? (
              <Row style={{ gap: 4 }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Tempo {se.tempo.replace(/-/g, '·')}
                </Text>
                <TempoInfo tempo={se.tempo} />
              </Row>
            ) : null}
            {restLabel ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{restLabel}</Text>
            ) : null}
          </Row>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
        </Pressable>
      </Row>

      <CuesField value={se.cues} onCommit={(v) => setExerciseCues(se.exerciseId, v)} />

      {/* Base-weight prompt for % warm-ups with no history */}
      {needBase && (
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
          <Caption>Enter your working weight so warm-ups can be calculated.</Caption>
          <Row style={{ gap: spacing(3) }}>
            <View style={{ flex: 1 }}>
              <BigNumberField label="kg" value={baseInput} onChange={setBaseInput} step={2.5} allowDecimal />
            </View>
            <View style={{ justifyContent: 'flex-end' }}>
              <Button
                title="Set"
                small
                disabled={baseInput == null}
                onPress={() => setPromptedBase(baseInput)}
              />
            </View>
          </Row>
        </View>
      )}

      {/* Warm-up sets */}
      {!isCardio && warmups.length > 0 && (
        <View style={{ gap: spacing(1.5) }}>
          <Text style={{ color: colors.textFaint, fontSize: font.tiny, letterSpacing: 0.5 }}>
            WARM-UP{base != null ? ` · from top set ${base}kg` : ''}
          </Text>
          {warmups.map((w, i) => {
            const logged = loggedWarm[i];
            if (logged) {
              return (
                <SetRow
                  key={`w-${logged.id}`}
                  tag={`W${i + 1}`}
                  tagColor={colors.warning}
                  label={setLabel(logged.weight, logged.reps)}
                  done
                  onPress={() => editRow(logged)}
                  onDelete={() => {
                    deleteSet(logged.id);
                    if (editingSetId === logged.id) resetToNew();
                  }}
                />
              );
            }
            const wt = warmupWeight(w);
            return (
              <View
                key={`w-plan-${w.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing(2),
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingVertical: spacing(2),
                  paddingHorizontal: spacing(3),
                }}
              >
                <Text style={{ color: colors.warning, fontWeight: '700', width: 34, fontSize: font.small }}>
                  W{i + 1}
                </Text>
                <Body style={{ flex: 1, color: colors.textMuted }}>
                  {wt != null ? `${wt} kg × ${w.reps ?? '—'}` : `${w.percent}% × ${w.reps ?? '—'}`}
                </Body>
                <Button
                  title="Log"
                  variant="ghost"
                  small
                  disabled={wt == null}
                  onPress={() => logWarmup(w, i)}
                />
              </View>
            );
          })}
        </View>
      )}

      {/* Last time (working) pills */}
      {!isCardio && last.sets.length > 0 && (
        <View style={{ gap: spacing(1.5) }}>
          <Text style={{ color: colors.textFaint, fontSize: font.tiny, letterSpacing: 0.5 }}>
            {`LAST TIME${last.at ? ` · ${daysAgoLabel(last.at).toUpperCase()}` : ''} · TAP TO REUSE`}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) }}>
            {last.sets.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  setDraftA(s.weight);
                  setDraftB(s.reps);
                }}
                style={{
                  backgroundColor: colors.cardAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.pill,
                  paddingVertical: spacing(1.5),
                  paddingHorizontal: spacing(3),
                }}
              >
                <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '600' }}>
                  {setLabel(s.weight, s.reps)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Working sets */}
      <Text style={{ color: colors.textFaint, fontSize: font.tiny, letterSpacing: 0.5 }}>
        WORKING{targetSets != null ? ` · ${loggedWork.length}/${targetSets} sets` : ''}
      </Text>
      {loggedWork.map((s) => {
        const pr = !isCardio ? prFor(s.setNumber, s.weight, s.reps) : null;
        const prLabel = pr?.heaviest
          ? 'Weight PR'
          : pr?.oneRm
            ? '1RM PR'
            : pr?.repsAtWeight
              ? 'Reps PR'
              : null;
        const label = isCardio
          ? [
              s.durationSec != null ? `${Math.round(s.durationSec / 60)} min` : null,
              s.distanceM != null ? `${s.distanceM} m` : null,
            ]
              .filter(Boolean)
              .join(' · ') || '–'
          : setLabel(s.weight, s.reps);
        return (
          <SetRow
            key={s.id}
            tag={`Set ${loggedWork.indexOf(s) + 1}`}
            tagColor={colors.textFaint}
            label={label}
            done
            active={editingSetId === s.id}
            badge={prLabel}
            onPress={() => editRow(s)}
            onDelete={() => {
              deleteSet(s.id);
              if (editingSetId === s.id) resetToNew();
            }}
          />
        );
      })}

      {/* Active working-set entry */}
      <View
        style={{
          gap: spacing(3),
          backgroundColor: colors.cardAlt,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: editingSetId != null ? colors.primary : colors.border,
          padding: spacing(3),
        }}
      >
        <Caption>
          {editingSet != null
            ? editingSet.isWarmup
              ? 'Editing warm-up'
              : `Editing set ${loggedWork.indexOf(editingSet) + 1}`
            : `Set ${workingNext}`}
        </Caption>
        <Row style={{ gap: spacing(4), justifyContent: 'center' }}>
          <BigNumberField
            label={isCardio ? 'minutes' : 'kg'}
            value={draftA}
            onChange={setDraftA}
            step={isCardio ? 1 : 2.5}
            allowDecimal
          />
          <BigNumberField
            label={isCardio ? 'metres' : 'reps'}
            value={draftB}
            onChange={setDraftB}
            step={isCardio ? 100 : 1}
          />
        </Row>
        {editingSetId != null ? (
          <View style={{ gap: spacing(2) }}>
            <Button title="✓ Save set" onPress={saveEdit} />
            <Row style={{ gap: spacing(2) }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" small onPress={resetToNew} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Delete set"
                  variant="danger"
                  small
                  onPress={() => {
                    if (editingSetId != null) deleteSet(editingSetId);
                    resetToNew();
                  }}
                />
              </View>
            </Row>
          </View>
        ) : (
          <Button title={`✓ Log set ${workingNext}`} onPress={logNew} />
        )}
      </View>

      {/* Remaining planned working slots */}
      {remainingWorking > 1 && (
        <Caption style={{ textAlign: 'center' }}>
          {remainingWorking - 1} more set{remainingWorking - 1 === 1 ? '' : 's'} planned
        </Caption>
      )}
    </Card>
  );
}

// --- a compact logged/plan set row ------------------------------------------
function SetRow({
  tag,
  tagColor,
  label,
  done,
  active,
  badge,
  onPress,
  onDelete,
}: {
  tag: string;
  tagColor: string;
  label: string;
  done?: boolean;
  active?: boolean;
  badge?: string | null;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(2),
        backgroundColor: active ? colors.cardAlt : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        borderRadius: radius.md,
        paddingVertical: spacing(2.5),
        paddingHorizontal: spacing(3),
      }}
    >
      <Text style={{ color: tagColor, fontWeight: '700', width: 42, fontSize: font.small }}>{tag}</Text>
      <Body style={{ flex: 1, fontWeight: '600' }}>{label}</Body>
      {badge ? <Badge label={`🏆 ${badge}`} color={colors.pr} /> : null}
      {done ? <Text style={{ color: colors.success, fontSize: 14 }}>✓</Text> : null}
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={{ color: colors.textFaint, fontSize: 15 }}>✕</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** "today" / "yesterday" / "N days ago" / "N weeks ago" for the last-session label. */
function daysAgoLabel(at: number): string {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.round((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

// --- big weight/reps entry (± and tap-to-type) -------------------------------
function BigNumberField({
  label,
  value,
  onChange,
  step = 1,
  allowDecimal = false,
  min = 0,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  allowDecimal?: boolean;
  min?: number;
}) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (!editing) setText(value?.toString() ?? '');
  }, [value, editing]);

  const commit = (t: string) => {
    const cleaned = t.replace(',', '.');
    if (cleaned === '') {
      onChange(null);
      return;
    }
    const n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
    if (!Number.isNaN(n)) onChange(Math.max(min, n));
  };
  const bump = (dir: number) => {
    const cur = value ?? 0;
    onChange(Math.max(min, +(cur + dir * step).toFixed(2)));
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing(1.5) }}>
      <Text style={{ fontSize: font.tiny, color: colors.textMuted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Row style={{ gap: spacing(2.5) }}>
        <RoundBtn label="–" onPress={() => bump(-1)} />
        {editing ? (
          <TextInput
            value={text}
            onChangeText={setText}
            onBlur={() => {
              commit(text);
              setEditing(false);
            }}
            onEndEditing={() => {
              commit(text);
              setEditing(false);
            }}
            keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
            autoFocus
            style={{
              minWidth: 72,
              textAlign: 'center',
              color: colors.text,
              fontSize: 30,
              fontWeight: '800',
            }}
          />
        ) : (
          <Pressable onPress={() => setEditing(true)} style={{ minWidth: 72 }}>
            <Text style={{ textAlign: 'center', color: colors.text, fontSize: 30, fontWeight: '800' }}>
              {value ?? '–'}
            </Text>
          </Pressable>
        )}
        <RoundBtn label="+" onPress={() => bump(1)} />
      </Row>
    </View>
  );
}

function RoundBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.primary, fontSize: 24, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
