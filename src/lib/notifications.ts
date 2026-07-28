import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PHOTO_REMINDER_ID = 'weekly-progress-photo';

/** Show reminders while the app is foregrounded too. Call once at startup. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// App uses 1 = Monday … 7 = Sunday; expo-notifications uses 1 = Sunday … 7 = Saturday.
function toExpoWeekday(appDay: number): number {
  return (appDay % 7) + 1;
}

/**
 * (Re)schedule the weekly "upload a progress photo" reminder.
 * Cancels any existing one first so settings changes take effect.
 */
export async function scheduleWeeklyPhotoReminder(opts: {
  enabled: boolean;
  day: number; // 1 = Monday
  hour: number;
  minute: number;
}): Promise<boolean> {
  await cancelWeeklyPhotoReminder();
  if (!opts.enabled) return true;

  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: PHOTO_REMINDER_ID,
    content: {
      title: '📸 Progress photo time',
      body: 'Snap this week’s progress photo to track how far you’ve come.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: toExpoWeekday(opts.day),
      hour: opts.hour,
      minute: opts.minute,
    },
  });
  return true;
}

export async function cancelWeeklyPhotoReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(PHOTO_REMINDER_ID);
  } catch {
    // no-op if it wasn't scheduled
  }
}

// ---------------------------------------------------------------------------
// Rest timer — fires when rest ends even if the app is backgrounded.
// ---------------------------------------------------------------------------

const REST_DONE_ID = 'rest-timer-done';

/** Schedule a one-off "rest over" notification at `endsAt` (epoch ms). */
export async function scheduleRestDoneNotification(
  endsAt: number,
  label: string | null
): Promise<void> {
  await cancelRestDoneNotification();
  const secondsAway = (endsAt - Date.now()) / 1000;
  if (secondsAway <= 0) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: REST_DONE_ID,
    content: {
      title: '⏱ Rest over',
      body: label ? `Next: ${label}` : 'Back to it 💪',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endsAt,
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
    },
  });
}

export async function cancelRestDoneNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_DONE_ID);
  } catch {
    // no-op if it wasn't scheduled
  }
}
