import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { getActiveSession, setsInRange, workoutsThisWeek } from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Body, Button, Caption, Card, H1, Loading, Row, Screen } from '@/components/ui';
import { BodyAvatar } from '@/components/BodyAvatar';
import { setsByMuscle } from '@/lib/metrics';
import { PARTS, partProgress, partLevels, type PartLevel } from '@/lib/physique';
import { formatDuration } from '@/lib/format';
import { startOfDay, weekRange } from '@/lib/week';
import { spacing, useTheme } from '@/theme/theme';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Stars({ level }: { level: PartLevel }) {
  const { colors } = useTheme();
  return (
    <Row style={{ gap: 2 }}>
      {[1, 2, 3].map((i) => (
        <Text key={i} style={{ fontSize: 14, color: i <= level ? colors.pr : colors.border }}>
          ★
        </Text>
      ))}
    </Row>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const { data } = useQuery(async () => {
    const { startMs, endMs } = weekRange(new Date());
    const [workouts, weekSets, active] = await Promise.all([
      workoutsThisWeek(startMs, endMs),
      setsInRange(startMs, endMs),
      getActiveSession(),
    ]);
    return { workouts, weekSets, active };
  }, []);

  if (!data) return <Loading />;

  const { workouts = [], weekSets = [], active = null } = data;
  const todayMs = startOfDay(new Date()).getTime();

  const progress = partProgress(
    setsByMuscle(weekSets.map((s) => ({ reps: s.reps, muscle: s.muscle ?? 'Other' })))
  );
  const levels = partLevels(progress);

  return (
    <Screen>
      <H1>Fit Diaries</H1>

      <Card>
        <Caption>Body overview · this week</Caption>
        <Row style={{ alignItems: 'center', gap: spacing(3) }}>
          <BodyAvatar levels={levels} size={200} />
          <View style={{ flex: 1, gap: spacing(2) }}>
            {PARTS.map((p) => {
              const pp = progress[p.key];
              return (
                <View key={p.key} style={{ gap: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body style={{ fontWeight: '600' }}>{p.label}</Body>
                    <Stars level={pp.level} />
                  </Row>
                  <Caption style={{ color: colors.textFaint }}>
                    {pp.sets > 0 ? `${pp.sets} / ${pp.target} sets` : 'not trained yet'}
                  </Caption>
                </View>
              );
            })}
          </View>
        </Row>
      </Card>

      {active ? (
        <Button
          title={`Resume ${active.dayName} →`}
          onPress={() => router.push(`/workout/${active.id}`)}
        />
      ) : (
        <Button title="Start workout" onPress={() => router.push('/workout/new')} />
      )}

      {workouts.length > 0 ? (
        <View style={{ gap: spacing(2) }}>
          {workouts.map((w) => {
            const isToday = w.startedAt >= todayMs;
            const when = isToday ? 'Today' : WEEKDAY[new Date(w.startedAt).getDay()];
            return (
              <Row
                key={w.id}
                style={{
                  gap: spacing(2.5),
                  backgroundColor: isToday ? colors.primary + '18' : colors.card,
                  borderWidth: 1,
                  borderColor: isToday ? colors.primary : colors.border,
                  borderRadius: 12,
                  paddingVertical: spacing(2.5),
                  paddingHorizontal: spacing(3.5),
                }}
              >
                <Body style={{ color: colors.success }}>✓</Body>
                <Body style={{ flex: 1, fontWeight: '600' }}>{w.dayName}</Body>
                <Caption>
                  {when} · {formatDuration(w.finishedAt - w.startedAt)}
                </Caption>
              </Row>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
