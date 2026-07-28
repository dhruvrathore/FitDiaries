import { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import { getSettings, updateSettings, type SettingsRow } from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Body, Button, Card, Caption, H3, Loading, Row, Screen } from '@/components/ui';
import { NumberField } from '@/components/NumberField';
import { Chip } from '@/components/ui';
import { importBackup, shareBackup } from '@/lib/backup';
import { scheduleWeeklyPhotoReminder } from '@/lib/notifications';
import { deloadWeekIndex, fromISODate, mondayOf, shortDate, toISODate } from '@/lib/week';
import { mmss } from '@/lib/format';
import { spacing, useTheme } from '@/theme/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Settings() {
  const { colors } = useTheme();
  const { data } = useQuery(() => getSettings(), []);
  if (!data) return <Loading />;
  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: SettingsRow }) {
  const { colors } = useTheme();

  const reschedule = async (s: SettingsRow) => {
    await scheduleWeeklyPhotoReminder({
      enabled: !!s.notificationsEnabled,
      day: s.notificationDay,
      hour: s.notificationHour,
      minute: s.notificationMinute,
    });
  };

  type Patch = Partial<{
    notificationsEnabled: boolean;
    notificationDay: number;
    notificationHour: number;
    notificationMinute: number;
    restSeconds: number;
    restSoundEnabled: boolean;
    deloadCycleStart: string;
  }>;

  // We rely on useQuery live refresh, but read the freshest values for reschedule.
  const patch = async (p: Patch, notif = false) => {
    await updateSettings(p);
    if (notif) {
      const fresh = await getSettings();
      if (fresh) await reschedule(fresh);
    }
  };

  const s = initial;
  const deloadIdx = deloadWeekIndex(new Date(), s.deloadCycleStart);

  return (
    <Screen>
      {/* Progress photo reminder */}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>📸 Photo reminder</H3>
          <Switch
            value={!!s.notificationsEnabled}
            onValueChange={(v) => patch({ notificationsEnabled: v }, true)}
          />
        </Row>
        <Caption>Weekly reminder to upload a progress photo.</Caption>

        <View style={{ opacity: s.notificationsEnabled ? 1 : 0.4, gap: spacing(3) }}>
          <View style={{ gap: spacing(2) }}>
            <Caption>Day</Caption>
            <Row style={{ flexWrap: 'wrap', gap: spacing(1.5) }}>
              {DAYS.map((d, i) => (
                <Chip
                  key={d}
                  label={d}
                  selected={s.notificationDay === i + 1}
                  onPress={() => s.notificationsEnabled && patch({ notificationDay: i + 1 }, true)}
                />
              ))}
            </Row>
          </View>
          <Row style={{ gap: spacing(3) }}>
            <NumberField
              label="hour (24h)"
              value={s.notificationHour}
              min={0}
              onCommit={(v) =>
                s.notificationsEnabled && patch({ notificationHour: clamp(v ?? 9, 0, 23) }, true)
              }
            />
            <NumberField
              label="minute"
              value={s.notificationMinute}
              min={0}
              step={5}
              onCommit={(v) =>
                s.notificationsEnabled && patch({ notificationMinute: clamp(v ?? 0, 0, 59) }, true)
              }
            />
          </Row>
          <Caption>
            Fires {DAYS[s.notificationDay - 1]} at{' '}
            {String(s.notificationHour).padStart(2, '0')}:
            {String(s.notificationMinute).padStart(2, '0')}
          </Caption>
        </View>
      </Card>

      {/* Rest timer */}
      <Card>
        <H3>⏱ Rest timer</H3>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Body>Default rest ({mmss(s.restSeconds)})</Body>
            <Caption>Auto-starts after each set.</Caption>
          </View>
          <View style={{ width: 150 }}>
            <NumberField
              label="seconds"
              value={s.restSeconds}
              step={15}
              min={0}
              onCommit={(v) => patch({ restSeconds: clamp(v ?? 90, 0, 900) })}
            />
          </View>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>Play sound when rest ends</Body>
          <Switch
            value={!!s.restSoundEnabled}
            onValueChange={(v) => patch({ restSoundEnabled: v })}
          />
        </Row>
      </Card>

      {/* Deload cycle */}
      <Card>
        <H3>🌙 Deload cycle</H3>
        <Caption>Every 4th week is a deload week.</Caption>
        <Body>
          Cycle started {shortDate(fromISODate(s.deloadCycleStart))} · currently week {deloadIdx} of 4
          {deloadIdx === 4 ? ' (deload)' : ''}
        </Body>
        <Button
          title="Reset cycle to this week"
          variant="secondary"
          small
          onPress={() => patch({ deloadCycleStart: toISODate(mondayOf(new Date())) })}
        />
      </Card>

      {/* Manage */}
      <Card>
        <H3>Manage</H3>
        <Button
          title="Workout templates"
          variant="secondary"
          onPress={() => router.push('/templates')}
        />
        <Button
          title="Exercises & cues"
          variant="secondary"
          onPress={() => router.push('/exercises')}
        />
        <Button
          title="Warm-up & cool-down movements"
          variant="secondary"
          onPress={() => router.push('/movements')}
        />
      </Card>

      {/* Backup & restore */}
      <BackupCard />

      <Caption style={{ textAlign: 'center', color: colors.textFaint }}>
        FitDiaries · all data stored on this device
      </Caption>
      <View style={{ height: spacing(6) }} />
    </Screen>
  );
}

function BackupCard() {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const onExport = async () => {
    setBusy('export');
    try {
      await shareBackup();
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setBusy(null);
    }
  };

  const onImport = () => {
    Alert.alert(
      'Restore from backup?',
      'This replaces ALL current data on this device with the contents of the backup file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          style: 'destructive',
          onPress: async () => {
            setBusy('import');
            try {
              const res = await importBackup();
              if (res.imported) {
                Alert.alert('Restore complete', `Loaded ${res.sessions} sessions from the backup.`);
              } else if (!res.cancelled) {
                Alert.alert('Restore failed', res.error ?? 'Unknown error');
              }
            } catch (e) {
              Alert.alert('Restore failed', String(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Card>
      <H3>💾 Backup &amp; restore</H3>
      <Caption>
        Export all your data to a JSON file you can save or send, and restore it on any device.
        Progress-photo files aren’t embedded — only their references.
      </Caption>
      <Button
        title={busy === 'export' ? 'Preparing…' : 'Export backup'}
        variant="secondary"
        disabled={busy !== null}
        onPress={onExport}
      />
      <Button
        title={busy === 'import' ? 'Restoring…' : 'Import backup'}
        variant="secondary"
        disabled={busy !== null}
        onPress={onImport}
      />
    </Card>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
