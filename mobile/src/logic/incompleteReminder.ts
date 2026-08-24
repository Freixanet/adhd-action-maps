/**
 * Local reminder to reopen an incomplete Núcleo.
 * One notification, evening window 18:00–21:00 local. Not a streak / dose.
 *
 * `expo-notifications` is optional until the native dev client is rebuilt with
 * that package. Loading its JS without ExpoPushTokenManager linked crashes the
 * app, so we probe the native module first and never require the package if
 * it is missing.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { nextIncompleteReminderDate } from '@shared/incompleteReminderSchedule';
import { trackProductEvent } from '@shared/productTelemetry';

const CHANNEL_ID = 'incomplete';
const REMINDER_ID_PREFIX = 'incomplete-';

/** Minimal surface we use — avoids `typeof import('expo-notifications')`. */
type NotificationsModule = {
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldShowBanner: boolean;
      shouldShowList: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }) => void;
  getPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  setNotificationChannelAsync: (
    id: string,
    config: { name: string; importance: number }
  ) => Promise<unknown>;
  AndroidImportance: { DEFAULT: number };
  cancelScheduledNotificationAsync: (id: string) => Promise<void>;
  scheduleNotificationAsync: (request: Record<string, unknown>) => Promise<string>;
  SchedulableTriggerInputTypes: { DATE: string };
  addNotificationResponseReceivedListener: (
    listener: (response: {
      notification: { request: { content: { data?: Record<string, unknown> } } };
    }) => void
  ) => { remove: () => void };
};

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;
let missingNativeWarned = false;

function hasNotificationsNative(): boolean {
  // Package entry pulls PushTokenManager.native → ExpoPushTokenManager.
  // Scheduler alone is not enough; missing push manager still crashes on require.
  return requireOptionalNativeModule('ExpoPushTokenManager') != null;
}

function loadNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;

  if (!hasNotificationsNative()) {
    if (__DEV__ && !missingNativeWarned) {
      missingNativeWarned = true;
      console.warn(
        '[notifications] ExpoPushTokenManager missing; rebuild the dev client (`npx expo run:ios`) to enable incomplete reminders.'
      );
    }
    notificationsModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as NotificationsModule;
    notificationsModule = mod;
    if (!handlerConfigured) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      handlerConfigured = true;
    }
    return mod;
  } catch (err) {
    if (__DEV__) {
      console.warn(
        '[notifications] expo-notifications failed to load',
        err instanceof Error ? err.message : err
      );
    }
    notificationsModule = null;
    return null;
  }
}

export function isNotificationsNativeAvailable(): boolean {
  return loadNotifications() != null;
}

async function ensurePermissions(Notifications: NotificationsModule): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return Boolean(asked.granted);
}

async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Núcleos a medias',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export { nextIncompleteReminderDate };

export async function cancelIncompleteReminder(entryId: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`${REMINDER_ID_PREFIX}${entryId}`);
  } catch {
    // Ignore missing ids / unlinked native module.
  }
}

export async function scheduleIncompleteReminder(options: {
  entryId: string;
  title: string;
}): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;

  const entryId = options.entryId.trim();
  if (!entryId) return false;

  try {
    const ok = await ensurePermissions(Notifications);
    if (!ok) return false;
    await ensureAndroidChannel(Notifications);
    await cancelIncompleteReminder(entryId);

    const when = nextIncompleteReminderDate();
    const label = options.title.trim() || 'tu Núcleo';
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_ID_PREFIX}${entryId}`,
      content: {
        title: 'Retoma aquí',
        body: `Te falta terminar «${label}».`,
        data: { entryId, type: 'incomplete' },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
    trackProductEvent('incomplete_reminder_scheduled');
    return true;
  } catch (err) {
    if (__DEV__) {
      console.warn(
        '[notifications] schedule failed',
        err instanceof Error ? err.message : err
      );
    }
    return false;
  }
}

export function parseIncompleteNotificationData(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data || data.type !== 'incomplete') return null;
  const id = typeof data.entryId === 'string' ? data.entryId.trim() : '';
  return id || null;
}

/** Subscribe to reminder taps. Returns null when native notifications are unavailable. */
export function addIncompleteNotificationResponseListener(
  onEntryId: (entryId: string) => void
): { remove: () => void } | null {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    return Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const entryId = parseIncompleteNotificationData(data);
      if (entryId) onEntryId(entryId);
    });
  } catch {
    return null;
  }
}
