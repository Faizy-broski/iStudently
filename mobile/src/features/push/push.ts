import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { auth } from '@/lib/api';

const ENABLED_KEY = 'push.enabled';
const TOKEN_KEY = 'push.token';

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** The user's choice for this phone (Settings → Push notifications); on by default. */
export function pushEnabled() {
  return Storage.getItemSync(ENABLED_KEY) !== 'off';
}

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;
}

/** Asks for permission (once) and returns this phone's Expo push token, or null if unavailable or refused. */
async function getToken(ask: boolean): Promise<string | null> {
  const id = projectId();
  // Simulators can't receive push; builds without an EAS project id can't get a token.
  if (!Device.isDevice || !id) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Studently', importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

/** Registers this phone for the signed-in user. Returns false when permission is refused. Never throws. */
export async function registerPush(ask = true): Promise<boolean> {
  try {
    const token = await getToken(ask);
    if (!token) return false;
    const r = await auth.registerPushDevice({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android', device_name: Device.modelName, app_version: Constants.expoConfig?.version ?? null });
    if (r.success) Storage.setItemSync(TOKEN_KEY, token);
    return r.success;
  } catch {
    return false;
  }
}

/** Stops push to this phone for the signed-in user (sign-out, or turned off in Settings). Never throws. */
export async function unregisterPush(): Promise<void> {
  const token = Storage.getItemSync(TOKEN_KEY);
  if (!token) return;
  try {
    await auth.unregisterPushDevice(token);
  } catch {
    // The server drops tokens Expo reports as unregistered anyway.
  }
  Storage.removeItemSync(TOKEN_KEY);
}

/** Turns push on or off for this phone. */
export async function setPushEnabled(on: boolean): Promise<boolean> {
  Storage.setItemSync(ENABLED_KEY, on ? 'on' : 'off');
  if (!on) {
    await unregisterPush();
    return true;
  }
  return registerPush(true);
}
