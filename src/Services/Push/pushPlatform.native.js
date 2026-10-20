import { getApp } from '@react-native-firebase/app';
import {
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import {
  checkNotifications,
  openSettings,
  requestNotifications,
} from 'react-native-permissions';

export const isPushSupported = true;

// Modular (RNFB v22-style) API. Resolved lazily so nothing touches Firebase
// until a push function is actually called (instance is cached by RNFB).
const fcm = () => getMessaging(getApp());

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
    const m = fcm();
    if (!isDeviceRegisteredForRemoteMessages(m)) {
      await registerDeviceForRemoteMessages(m);
    }
    return await getToken(m);
  } catch (e) {
    console.warn('[push] getToken failed', e?.message || e);
    return null;
  }
}

export async function deletePushToken() {
  try {
    await deleteToken(fcm());
  } catch (e) {
    console.warn('[push] deleteToken failed', e?.message || e);
  }
}

export const onPushTokenRefresh = cb => onTokenRefresh(fcm(), cb);

// remoteMessage -> { messageId, title, body, data }. messageId lets the
// manager handle each tap once (RNFB also re-reports a tapped push as the
// initial notification after a JS reload).
const normalize = m =>
  m
    ? {
        messageId:
          m.messageId ||
          m.data?.['gcm.message_id'] ||
          m.data?.['google.message_id'] ||
          null,
        title: m.notification?.title || '',
        body: m.notification?.body || '',
        data: m.data || {},
      }
    : null;

export const onForegroundPush = cb => onMessage(fcm(), m => cb(normalize(m)));

export const onPushOpened = cb =>
  onNotificationOpenedApp(fcm(), m => cb(normalize(m)));

export async function getInitialPush() {
  try {
    return normalize(await getInitialNotification(fcm()));
  } catch {
    return null;
  }
}

// Must run at module load (index.js), outside React. The OS shows
// notification payloads itself; nothing else to do in the background.
export function registerBackgroundPushHandler() {
  setBackgroundMessageHandler(fcm(), async () => {});
}
