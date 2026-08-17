import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  allSetsWithExercise,
  deleteSession,
  getSessionExercises,
  getSessionHeader,
  getSessionMobility,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import {
  Badge,
  Body,
  Button,
  Card,
  Caption,
  Divider,
  EmptyState,
  H2,
  H3,
  Loading,
  Row,
  Screen,
} from '@/components/ui';
import { totalVolume } from '@/lib/metrics';
import { buildSessionText, shareText } from '@/lib/exportWorkout';
import { computeAllPREvents } from '@/lib/progress';
import { PR_LABEL } from '@/lib/metrics';
import { compactNumber, kg, setLabel } from '@/lib/format';
import { shortDate } from '@/lib/week';
import { phaseColor, phaseLabel, spacing, useTheme } from '@/theme/theme';

export default function SessionDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);

  const { data } = useQuery(async () => {
    const header = await getSessionHeader(sessionId);
    if (!header) return null;
    const [exercises, mobility, allSets] = await Promise.all([
      getSessionExercises(sessionId),
      getSessionMobility(sessionId, header.templateId),
      allSetsWithExercise(),
    ]);
    const prs = computeAllPREvents(allSets).filter((e) => e.at === header.startedAt);
    const volume = totalVolume(exercises.flatMap((e) => e.sets).filter((s) => !s.isWarmup));
    return { header, exercises, mobility, prs, volume };
  }, [sessionId]);

  if (data === undefined) return <Loading />;
  if (data === null)
    return (
      <Screen>
        <EmptyState title="Session not found" />
      </Screen>
    );

  const { header, exercises, mobility, prs, volume } = data;
  const checked = mobility.filter((m) => m.checked).length;

  return (
    <Screen>
      <View style={{ gap: spacing(2) }}>
        <Row style={{ gap: spacing(2) }}>
          <H2>{header.dayName}</H2>
          <Badge label={phaseLabel[header.phase]} color={phaseColor[header.phase]} />
        </Row>
        <Caption>{shortDate(new Date(header.startedAt))}</Caption>
        {header.bodyWeight != null && <Caption>Body weight: {kg(header.bodyWeight)} kg</Caption>}
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-around' }}>
          <Stat value={compactNumber(volume)} label="volume (kg)" color={colors.primary} />
          <Stat value={`${exercises.flatMap((e) => e.sets).length}`} label="sets" color={colors.text} />
          <Stat value={`${prs.length}`} label="PRs" color={colors.pr} />
        </Row>
      </Card>

      {prs.length > 0 && (
        <Card style={{ borderColor: colors.pr }}>
          <H3>🏆 Personal records</H3>
          {prs.map((e, i) => (
            <Row key={i} style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '600' }}>{e.exerciseName}</Body>
              <Caption>
                {PR_LABEL[e.type]} · {setLabel(e.weight, e.reps)}
              </Caption>
            </Row>
          ))}
        </Card>
      )}

      {exercises.map((se) => (
        <Card key={se.sessionExerciseId}>
          <Body style={{ fontWeight: '700', fontSize: 16 }}>{se.name}</Body>
          {se.muscle ? <Caption>{se.muscle}</Caption> : null}
          <View style={{ gap: 4, marginTop: spacing(1) }}>
            {se.sets.length === 0 ? (
              <Caption>No sets logged</Caption>
            ) : (
              se.sets.map((s) => (
                <Row key={s.id} style={{ justifyContent: 'space-between' }}>
                  <Caption>Set {s.setNumber}</Caption>
                  <Body>
                    {se.metric === 'cardio'
                      ? `${s.durationSec ? Math.round(s.durationSec / 60) + ' min' : ''} ${
                          s.distanceM ? s.distanceM + ' m' : ''
                        }`.trim() || '–'
                      : setLabel(s.weight, s.reps)}
                  </Body>
                </Row>
              ))
            )}
          </View>
        </Card>
      ))}

      {mobility.length > 0 && (
        <Card>
          <H3>Mobility</H3>
          <Caption>
            {checked}/{mobility.length} completed
          </Caption>
        </Card>
      )}

      <Divider />
      <Button
        title="Share workout"
        variant="secondary"
        onPress={async () => {
          try {
            const text = await buildSessionText(sessionId);
            if (text) await shareText(text, `${header.dayName} · ${shortDate(new Date(header.startedAt))}`);
          } catch (e) {
            Alert.alert('Could not export', 'Something went wrong exporting this workout.');
          }
        }}
      />
      {!header.finishedAt && (
        <Button title="Resume workout" onPress={() => router.replace(`/workout/${sessionId}`)} />
      )}
      <Button
        title="Delete session"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete session?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteSession(sessionId);
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Body style={{ fontSize: 24, fontWeight: '800', color }}>{value}</Body>
      <Caption style={{ color: colors.textMuted }}>{label}</Caption>
    </View>
  );
}
