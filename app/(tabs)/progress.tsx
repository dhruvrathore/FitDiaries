import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { allSetsWithExercise, setsInRange } from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Body, Card, Caption, Chip, EmptyState, H3, Loading, Row, Screen } from '@/components/ui';
import { BarChart, HBars, LineChart } from '@/components/Charts';
import { volumeByMuscle } from '@/lib/metrics';
import {
  PR_EMOJI,
  computeAllPREvents,
  exerciseProgressions,
  weeklyVolumeSeries,
} from '@/lib/progress';
import { PR_LABEL } from '@/lib/metrics';
import { compactNumber, setLabel } from '@/lib/format';
import { shortDate, weekRange } from '@/lib/week';
import { spacing, useTheme } from '@/theme/theme';

const WEEKS = 8;

export default function Progress() {
  const { colors } = useTheme();
  const { data } = useQuery(async () => {
    const now = new Date();
    const { startMs, endMs } = weekRange(now);
    const [allSets, weekSets] = await Promise.all([
      allSetsWithExercise(),
      setsInRange(startMs, endMs),
    ]);
    return {
      series: weeklyVolumeSeries(allSets, WEEKS, now),
      muscle: volumeByMuscle(
        weekSets.map((s) => ({ weight: s.weight, reps: s.reps, muscle: s.muscle ?? 'Other' }))
      ),
      prs: computeAllPREvents(allSets),
      progressions: exerciseProgressions(allSets),
    };
  }, []);

  const [exId, setExId] = useState<number | null>(null);

  const muscleData = useMemo(
    () =>
      data
        ? Object.entries(data.muscle)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
        : [],
    [data]
  );

  if (!data) return <Loading />;

  const hasAny = data.series.some((s) => s.volume > 0);
  if (!hasAny)
    return (
      <Screen>
        <Card onPress={() => router.push('/photos')}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <H3>📸 Progress photos</H3>
              <Caption>See how you look week to week.</Caption>
            </View>
            <Text style={{ color: colors.textFaint, fontSize: 18 }}>›</Text>
          </Row>
        </Card>
        <EmptyState
          emoji="📈"
          title="No data yet"
          subtitle="Log a few workouts and your volume, muscle split, and PRs will appear here."
        />
      </Screen>
    );

  const selected =
    data.progressions.find((p) => p.exerciseId === exId) ?? data.progressions[0] ?? null;

  return (
    <Screen>
      {/* Progress photos (moved here from its own tab) */}
      <Card onPress={() => router.push('/photos')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <H3>📸 Progress photos</H3>
            <Caption>See how you look week to week.</Caption>
          </View>
          <Text style={{ color: colors.textFaint, fontSize: 18 }}>›</Text>
        </Row>
      </Card>

      {/* Weekly volume trend */}
      <Card>
        <H3>Weekly volume</H3>
        <Caption>Total weight × reps, last {WEEKS} weeks</Caption>
        <BarChart
          data={data.series.map((s) => ({
            label: shortDate(new Date(s.weekISO)).split(' ').slice(1).join(' '),
            value: s.volume,
          }))}
        />
      </Card>

      {/* Volume by muscle (this week) */}
      <Card>
        <H3>Volume by muscle</H3>
        <Caption>This week</Caption>
        {muscleData.length > 0 ? (
          <HBars data={muscleData} />
        ) : (
          <Caption>No sets logged this week yet.</Caption>
        )}
      </Card>

      {/* Per-exercise progression */}
      {selected && (
        <Card>
          <H3>Exercise progression</H3>
          <Caption>Best estimated 1RM per session</Caption>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing(2), paddingVertical: spacing(1) }}
          >
            {data.progressions.slice(0, 20).map((p) => (
              <Chip
                key={p.exerciseId}
                label={p.name}
                selected={p.exerciseId === selected.exerciseId}
                onPress={() => setExId(p.exerciseId)}
              />
            ))}
          </ScrollView>
          {selected.points.length > 1 ? (
            <LineChart values={selected.points.map((pt) => pt.oneRm)} />
          ) : (
            <Caption>Need at least two sessions to chart {selected.name}.</Caption>
          )}
          <Row style={{ justifyContent: 'space-between' }}>
            <Caption>
              Start: {compactNumber(selected.points[0].oneRm)} kg
            </Caption>
            <Caption>
              Now: {compactNumber(selected.points[selected.points.length - 1].oneRm)} kg
            </Caption>
          </Row>
        </Card>
      )}

      {/* PR log */}
      <Card>
        <H3>🏆 Personal records</H3>
        {data.prs.length === 0 ? (
          <Caption>No PRs yet — keep pushing.</Caption>
        ) : (
          <View style={{ gap: spacing(2) }}>
            {data.prs.slice(0, 40).map((e, i) => (
              <Row key={i} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>
                    {PR_EMOJI[e.type]} {e.exerciseName}
                  </Body>
                  <Caption>
                    {PR_LABEL[e.type]} · {setLabel(e.weight, e.reps)}
                  </Caption>
                </View>
                <Caption>{shortDate(new Date(e.at))}</Caption>
              </Row>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}
