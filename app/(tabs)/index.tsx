import { View } from 'react-native';
import { router } from 'expo-router';

import { getActiveSession, workoutsThisWeek } from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Body, Button, Caption, H1, Loading, Row, Screen } from '@/components/ui';
import { formatDuration } from '@/lib/format';
import { startOfDay, weekRange } from '@/lib/week';
import { spacing, useTheme } from '@/theme/theme';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Home() {
  const { colors } = useTheme();
  const { data } = useQuery(async () => {
    const { startMs, endMs } = weekRange(new Date());
    const [workouts, active] = await Promise.all([
      workoutsThisWeek(startMs, endMs),
      getActiveSession(),
    ]);
    return { workouts, active };
  }, []);

  if (!data) return <Loading />;

  const { workouts = [], active = null } = data;
  const totalMs = workouts.reduce((sum, w) => sum + (w.finishedAt - w.startedAt), 0);
  const todayMs = startOfDay(new Date()).getTime();

  return (
    <Screen scroll={false} contentStyle={{ flex: 1 }}>
      <H1>Fit Diaries</H1>

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing(5) }}>
        <View style={{ alignItems: 'center', gap: spacing(1) }}>
          <Body style={{ fontSize: 72, fontWeight: '800', color: colors.primary, lineHeight: 76 }}>
            {workouts.length}
          </Body>
          <Caption style={{ fontSize: 15 }}>workouts this week</Caption>
          {workouts.length > 0 ? (
            <Caption style={{ color: colors.textFaint }}>{formatDuration(totalMs)} total</Caption>
          ) : null}
        </View>

        {workouts.length === 0 ? (
          <Caption style={{ textAlign: 'center' }}>No workouts yet — let’s go.</Caption>
        ) : (
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
        )}
      </View>

      {active ? (
        <Button
          title={`Resume ${active.dayName} →`}
          onPress={() => router.push(`/workout/${active.id}`)}
        />
      ) : (
        <Button title="Start workout" onPress={() => router.push('/workout/new')} />
      )}
    </Screen>
  );
}
