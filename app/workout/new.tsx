import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import {
  createSessionFromTemplate,
  getSettings,
  listTemplates,
  suggestedTemplateId,
  type TemplateRow,
} from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Badge, Body, Button, Card, Caption, H2, Loading, Row } from '@/components/ui';
import { Screen } from '@/components/ui';
import { PHASES, phaseColor, phaseLabel, spacing, useTheme, type Phase } from '@/theme/theme';
import { isDeloadWeek } from '@/lib/week';
import { Chip } from '@/components/ui';

export default function NewWorkout() {
  const { colors } = useTheme();
  const { data } = useQuery(async () => {
    const [templates, suggestedId, settings] = await Promise.all([
      listTemplates(),
      suggestedTemplateId(),
      getSettings(),
    ]);
    return { templates, suggestedId, settings };
  }, []);

  const deload = useMemo(
    () => (data?.settings ? isDeloadWeek(new Date(), data.settings.deloadCycleStart) : false),
    [data?.settings]
  );

  const [templateId, setTemplateId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('hypertrophy');
  const [starting, setStarting] = useState(false);

  // Apply suggestions once data arrives.
  useEffect(() => {
    if (data && templateId == null && data.suggestedId != null) {
      setTemplateId(data.suggestedId);
    }
  }, [data, templateId]);
  useEffect(() => {
    if (deload) setPhase('deload');
  }, [deload]);

  if (!data) return <Loading />;

  const start = async (tmpl: TemplateRow) => {
    setStarting(true);
    const id = await createSessionFromTemplate(tmpl, phase);
    router.replace(`/workout/${id}`);
  };

  const selected = data.templates.find((t) => t.id === templateId) ?? null;

  return (
    <Screen>
      {deload && (
        <Card style={{ borderColor: colors.warning, backgroundColor: colors.warning + '18' }}>
          <Row>
            <Body style={{ fontSize: 20 }}>🌙</Body>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>Deload week</Body>
              <Caption>Ease off — lighter loads and lower volume this week.</Caption>
            </View>
          </Row>
        </Card>
      )}

      <View style={{ gap: spacing(2) }}>
        <H2>Pick your day</H2>
        <Caption>
          Suggested next in your rotation is highlighted — pick any day if you’re switching it up.
        </Caption>
      </View>

      <View style={{ gap: spacing(2.5) }}>
        {data.templates.map((t) => {
          const isSel = t.id === templateId;
          const isSuggested = t.id === data.suggestedId;
          return (
            <Card
              key={t.id}
              onPress={() => setTemplateId(t.id)}
              style={{
                borderColor: isSel ? colors.primary : colors.border,
                borderWidth: isSel ? 2 : 1,
              }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ fontWeight: '700', fontSize: 17 }}>{t.name}</Body>
                {isSuggested && <Badge label="Next up" color={colors.primary} />}
              </Row>
            </Card>
          );
        })}
      </View>

      <View style={{ gap: spacing(2) }}>
        <H2>Phase</H2>
        <Row style={{ flexWrap: 'wrap', gap: spacing(2) }}>
          {PHASES.map((p) => (
            <Chip
              key={p}
              label={phaseLabel[p]}
              selected={phase === p}
              color={phaseColor[p]}
              onPress={() => setPhase(p)}
            />
          ))}
        </Row>
      </View>

      <Button
        title={selected ? `Start ${selected.name}` : 'Select a day'}
        disabled={!selected || starting}
        onPress={() => selected && start(selected)}
      />
    </Screen>
  );
}
