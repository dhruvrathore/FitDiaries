import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { listSessions, type SessionSummary } from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Badge, Body, Card, Caption, EmptyState, Loading, Row, Screen } from '@/components/ui';
import { buildWeekText, shareText } from '@/lib/exportWorkout';
import { compactNumber } from '@/lib/format';
import { mondayOf, relativeWeekLabel, shortDate, toISODate, weekLabel } from '@/lib/week';
import { phaseColor, phaseLabel, spacing, useTheme } from '@/theme/theme';

type WeekGroup = { key: string; monday: Date; sessions: SessionSummary[] };

/** Group the (DESC-sorted) sessions by their Monday, preserving newest-first order. */
function groupByWeek(sessions: SessionSummary[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();
  for (const s of sessions) {
    const monday = mondayOf(new Date(s.startedAt));
    const key = toISODate(monday);
    let group = groups.get(key);
    if (!group) {
      group = { key, monday, sessions: [] };
      groups.set(key, group);
    }
    group.sessions.push(s);
  }
  return Array.from(groups.values());
}

export default function History() {
  const { data } = useQuery(() => listSessions(), []);

  if (!data) return <Loading />;
  if (data.length === 0)
    return (
      <Screen>
        <EmptyState
          emoji="📋"
          title="No workouts yet"
          subtitle="Start a workout from the Today tab and it’ll show up here."
        />
      </Screen>
    );

  const now = new Date();
  const groups = groupByWeek(data);

  return (
    <Screen>
      {groups.map((g) => (
        <View key={g.key} style={{ gap: spacing(2.5) }}>
          <WeekHeader group={g} now={now} />
          {g.sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function WeekHeader({ group, now }: { group: WeekGroup; now: Date }) {
  const { colors } = useTheme();
  const relative = relativeWeekLabel(group.monday, now);
  const range = weekLabel(group.monday);
  const count = group.sessions.length;
  const countLabel = `${count} ${count === 1 ? 'workout' : 'workouts'}`;

  const exportWeek = async () => {
    try {
      const text = await buildWeekText(group.monday.getTime());
      await shareText(text, `FitDiaries — week of ${range}`);
    } catch {
      Alert.alert('Could not export', 'Something went wrong exporting this week.');
    }
  };

  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing(1) }}>
      <Body style={{ fontWeight: '700', fontSize: 16 }}>{relative ?? range}</Body>
      <Row style={{ gap: spacing(2), alignItems: 'baseline' }}>
        <Caption>{relative ? `${range} · ${countLabel}` : countLabel}</Caption>
        <Pressable onPress={exportWeek} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Export</Text>
        </Pressable>
      </Row>
    </Row>
  );
}

function SessionCard({ session: s }: { session: SessionSummary }) {
  const { colors } = useTheme();
  return (
    <Card onPress={() => router.push(`/session/${s.id}`)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Row style={{ gap: spacing(2) }}>
            <Body style={{ fontWeight: '700', fontSize: 16 }}>{s.dayName}</Body>
            <Badge label={phaseLabel[s.phase]} color={phaseColor[s.phase]} />
            {!s.finishedAt && <Badge label="In progress" color={colors.warning} />}
          </Row>
          <Caption>{shortDate(new Date(s.startedAt))}</Caption>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Body style={{ fontWeight: '800', color: colors.primary }}>
            {compactNumber(s.volume)}
          </Body>
          <Caption>{s.setCount} sets</Caption>
        </View>
      </Row>
    </Card>
  );
}
