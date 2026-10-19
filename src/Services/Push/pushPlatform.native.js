import messaging from '@react-native-firebase/messaging';
import {
  checkNotifications,
  openSettings,
  requestNotifications,
} from 'react-native-permissions';

export const isPushSupported = true;

const toStatus = s => (s === 'granted' || s === 'limited' ? 'granted' : s); // denied | blocked | unavailable

export async function checkPushPermission() {
  try {
    const { status } = await checkNotifications();
    return toStatus(status);
  } catch (e) {
    console.warn('[push] checkNotifications threw', e?.message || e);
    return 'unavailable';
  }
}

export async function requestPushPermission() {
  try {
    const { status } = await requestNotifications(['alert', 'sound', 'badge']);
    return toStatus(status);
  } catch (e) {
    console.warn('[push] requestNotifications threw', e?.message || e);
    return 'unavailable';
  }
}

export function openPushSettings() {
  return openSettings().catch(() => {});
}

export async function getPushToken() {
  try {
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }
    return await messaging().getToken();
  } catch (e) {
    console.warn('[push] getToken failed', e?.message || e);
    return null;
  }
}

export async function deletePushToken() {
  try {
    await messaging().deleteToken();
  } catch (e) {
    console.warn('[push] deleteToken failed', e?.message || e);
  }
}

export const onPushTokenRefresh = cb => messaging().onTokenRefresh(cb);

// remoteMessage -> { title, body, data }
const normalize = m =>
  m
    ? {
        title: m.notification?.title || '',
        body: m.notification?.body || '',
        data: m.data || {},
      }
    : null;

export const onForegroundPush = cb =>
  messaging().onMessage(m => cb(normalize(m)));

export const onPushOpened = cb =>
  messaging().onNotificationOpenedApp(m => cb(normalize(m)));

export async function getInitialPush() {
  try {
    return normalize(await messaging().getInitialNotification());
  } catch {
    return null;
  }
}

// Must run at module load (index.js), outside React. The OS shows
// notification payloads itself; nothing else to do in the background.
export function registerBackgroundPushHandler() {
  messaging().setBackgroundMessageHandler(async () => {});
}
