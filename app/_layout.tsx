import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { db } from '@/db/client';
import { ensureSeeded } from '@/db/seed';
import { getSettings } from '@/db/queries';
import { Loading } from '@/components/ui';
import { useTheme } from '@/theme/theme';
import {
  configureNotificationHandler,
  scheduleWeeklyPhotoReminder,
} from '@/lib/notifications';
import migrations from '../drizzle/migrations';

configureNotificationHandler();

export default function RootLayout() {
  const { colors, dark } = useTheme();
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (success) {
      ensureSeeded()
        .then(async () => {
          setSeeded(true);
          // Keep the weekly photo reminder registered per current settings.
          const s = await getSettings();
          if (s) {
            await scheduleWeeklyPhotoReminder({
              enabled: !!s.notificationsEnabled,
              day: s.notificationDay,
              hour: s.notificationHour,
              minute: s.notificationMinute,
            });
          }
        })
        .catch((e) => console.warn('[seed]', e));
    }
  }, [success]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.bg,
        }}
      >
        <Text style={{ color: colors.danger, textAlign: 'center' }}>
          Database migration failed: {error.message}
        </Text>
      </View>
    );
  }

  if (!success || !seeded) return <Loading />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="workout/new"
            options={{ title: 'Start workout', presentation: 'modal' }}
          />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
          <Stack.Screen name="session/[id]" options={{ title: 'Session' }} />
          <Stack.Screen name="exercises" options={{ title: 'Exercises' }} />
          <Stack.Screen name="templates/index" options={{ title: 'Workout templates' }} />
          <Stack.Screen name="templates/[id]" options={{ title: 'Edit template' }} />
          <Stack.Screen name="templates/mobility" options={{ title: 'Mobility' }} />
          <Stack.Screen name="templates/exercise" options={{ title: 'Exercise setup' }} />
          <Stack.Screen name="movements" options={{ title: 'Warm-up & cool-down' }} />
          <Stack.Screen name="photos" options={{ title: 'Progress photos' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
