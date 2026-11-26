import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { navigationRef } from '@/Utils/NavigationService';
import appAlert from '@/Utils/appAlert';
import { CommonActions } from '@react-navigation/native';
import { cashOutPushOnPage, walletRefreshOnScreen } from '@/Utils/cashOut';
import LightTheme from '@/Theme/LightTheme';
import {
  PUSH_TYPES,
  emitBookingUpdate,
  formatPushBody,
  getPushRoute,
  parsePushData,
} from './pushEvents';
import {
  checkPushPermission,
  getInitialPush,
  getPushToken,
  isPushSupported,
  onForegroundPush,
  onPushOpened,
  onPushTokenRefresh,
  openPushSettings,
  requestPushPermission,
} from './pushPlatform';

const PROMPT_SHOWN_KEY = 'push_permission_prompt_shown_v1';
// Message ids of taps already routed. Persisted so a JS reload (where RNFB
// hands back the same tap via getInitialNotification) doesn't route it again.
const HANDLED_IDS_KEY = 'push_handled_message_ids_v1';
const HANDLED_IDS_MAX = 30;
const BANNER_MS = 5000;
// Shown in the box both apps use for money, not the banner (foreground)
const MONEY_PUSHES = [
  PUSH_TYPES.WALLET_CREDITED,
  PUSH_TYPES.CASH_OUT_PAID,
  PUSH_TYPES.CASH_OUT_FAILED,
];
// Routes where a logged-in user may be sent from a notification tap.
// A push tapped on these waits: the person is not in the app yet. The Terms
// screen (asked to accept before going on) and Update Required were skipped
// by a tapped push until the overnight review of 2026-11-23.
const NOT_READY_ROUTES = [
  'Splash',
  'OnboardingScreen',
  'LandingScreen',
  'GeneralTermsScreen',
  'UpdateRequiredScreen',
];

const colors = LightTheme.colors;
const topInset = initialWindowMetrics?.insets?.top ?? 0;

const currentRouteName = () =>
  navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;

// The trip's chat is on screen for this booking: its messages show there.
const chatOnScreen = bookingId => {
  if (!navigationRef.isReady() || bookingId == null) {
    return false;
  }
  const route = navigationRef.getCurrentRoute();
  return (
    route?.name === 'ChatScreen' &&
    String(route?.params?.bookingId) === String(bookingId)
  );
};

/**
 * Passenger push notifications (native only; renders nothing on web):
 * - after login, on Home: pre-prompt -> OS permission, else a "turn it on" banner
 * - registers the FCM token (login + refresh) at customers/update_firebase_token/
 * - foreground: in-app banner + immediate Home refresh
 * - background/quit tap: routes by payload type via navigationRef
 */
const PushNotificationManager = () => {
  const userInfo = useSelector(selectUserInfo);
  const customerId = userInfo?.id;
  const tokenRequest = useApiRequest();

  const [routeName, setRouteName] = useState(currentRouteName());
  const [permission, setPermission] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [offBannerDismissed, setOffBannerDismissed] = useState(false);
  const [banner, setBanner] = useState(null);
  const bannerTimer = useRef(null);
  const pendingRoute = useRef(null);
  const lastSent = useRef(null);
  const customerIdRef = useRef(customerId);
  customerIdRef.current = customerId;
  const handledIds = useRef(null); // string[] once loaded
  const handledLoad = useRef(null);

  // ---- track the current route (navigationRef lives outside this tree)
  useEffect(() => {
    if (!isPushSupported) {
      return undefined;
    }
    const update = () => setRouteName(currentRouteName());
    const unsub = navigationRef.addListener('state', update);
    const t = setInterval(() => {
      if (navigationRef.isReady()) {
        update();
        clearInterval(t);
      }
    }, 300);
    return () => {
      unsub?.();
      clearInterval(t);
    };
  }, []);

  // ---- token registration
  const registerToken = useCallback(
    async token => {
      if (!token || !customerId) {
        return;
      }
      const key = `${customerId}:${token}`;
      if (lastSent.current === key) {
        return;
      }
      const { error } = await tokenRequest.request(
        'PUT',
        Constants.API.CUSTOMER_FIREBASE_TOKEN(customerId),
        { firebaseToken: token },
      );
      if (error) {
        console.warn('[push] token registration failed:', error);
        return;
      }
      console.info('[push] token saved on server for customer', customerId);
      lastSent.current = key;
    },
    [customerId],
  );

  const registerCurrentToken = useCallback(async () => {
    const token = await getPushToken();
    if (!token) {
      console.warn(
        '[push] no FCM token — use a native dev build (npx expo run:ios / run:android), not web or Expo Go; allow notifications in system settings',
      );
      return;
    }
    console.info('[push] registering FCM token with backend…');
    await registerToken(token);
  }, [registerToken]);

  useEffect(() => {
    if (!isPushSupported || !customerId) {
      lastSent.current = null;
      return undefined;
    }
    return onPushTokenRefresh(token => registerToken(token));
  }, [customerId, registerToken]);

  // ---- permission: register token whenever logged in + granted; pre-prompt only on Home
  const onHome = routeName === 'HomeScreen';
  useEffect(() => {
    if (!isPushSupported || !customerId) {
      return;
    }
    let cancelled = false;
    (async () => {
      console.info(
        '[push] checking permission for customer',
        customerId,
        'route',
        routeName,
      );
      const status = await checkPushPermission();
      console.info('[push] checkNotifications ->', status);
      if (cancelled) {
        console.info('[push] permission check cancelled (route/user changed)');
        return;
      }
      setPermission(status);
      if (status === 'granted') {
        console.info('[push] granted, registering token');
        registerCurrentToken();
      } else if (status === 'denied') {
        const shown = await AsyncStorage.getItem(PROMPT_SHOWN_KEY);
        if (cancelled) {
          console.info('[push] cancelled before prompt decision');
          return;
        }
        if (!shown) {
          console.info(
            '[push] not asked yet, showing "Stay updated" prompt on Home',
          );
          setShowPrompt(true);
        } else {
          console.info(
            '[push] prompt already shown before, showing off banner instead',
          );
        }
      } else if (status === 'blocked') {
        console.warn(
          '[push] notifications blocked — enable in system Settings',
        );
      } else {
        console.warn('[push] permission status unavailable/unknown:', status);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, onHome, registerCurrentToken]);

  const handleAllow = async () => {
    setShowPrompt(false);
    await AsyncStorage.setItem(PROMPT_SHOWN_KEY, '1');
    console.info('[push] Allow tapped, asking iOS/Android');
    const status = await requestPushPermission();
    console.info('[push] requestNotifications ->', status);
    setPermission(status);
    if (status === 'granted') {
      registerCurrentToken();
    }
  };

  const handleNotNow = async () => {
    console.info('[push] Not now tapped');
    setShowPrompt(false);
    await AsyncStorage.setItem(PROMPT_SHOWN_KEY, '1');
  };

  const handleTurnOn = async () => {
    if (permission === 'denied') {
      // still requestable (Android 13+ after one "Not now")
      const status = await requestPushPermission();
      setPermission(status);
      if (status === 'granted') {
        registerCurrentToken();
        return;
      }
    }
    openPushSettings();
  };

  // ---- tap routing
  // Every tap (closed, background, system banner while open, in-app banner)
  // goes through handleTap -> routeTo. routeTo reads the customer id from a
  // ref so it stays stable and the initial-notification check runs once.
  const routeTo = useCallback(msg => {
    const target = getPushRoute(parsePushData(msg?.data));
    if (!target) {
      return;
    }
    const name = currentRouteName();
    if (!customerIdRef.current) {
      pendingRoute.current = null; // logged out: just open the app (PN-48)
      return;
    }
    if (!name || NOT_READY_ROUTES.includes(name)) {
      pendingRoute.current = target; // wait for Splash -> Home
      return;
    }
    navigationRef.navigate(target.name, target.params);
  }, []);

  const loadHandledIds = useCallback(() => {
    if (!handledLoad.current) {
      handledLoad.current = AsyncStorage.getItem(HANDLED_IDS_KEY)
        .then(raw => {
          const list = raw ? JSON.parse(raw) : [];
          handledIds.current = Array.isArray(list) ? list : [];
        })
        .catch(() => {
          handledIds.current = [];
        });
    }
    return handledLoad.current;
  }, []);

  // true the first time a message id is seen; false for a repeat
  const claimMessage = useCallback(
    async msg => {
      const id = msg?.messageId;
      if (!id) {
        return true; // nothing to dedupe on
      }
      await loadHandledIds();
      const list = handledIds.current || [];
      if (list.includes(id)) {
        console.info('[push] tap already handled, skipping', id);
        return false;
      }
      handledIds.current = [...list, id].slice(-HANDLED_IDS_MAX);
      AsyncStorage.setItem(
        HANDLED_IDS_KEY,
        JSON.stringify(handledIds.current),
      ).catch(() => {});
      return true;
    },
    [loadHandledIds],
  );

  const handleTap = useCallback(
    async (msg, { refresh = false } = {}) => {
      if (!msg) {
        return;
      }
      // the same push may be on screen as the in-app banner too
      setBanner(b =>
        b && msg.messageId && b.messageId === msg.messageId ? null : b,
      );
      if (!(await claimMessage(msg))) {
        return;
      }
      if (refresh) {
        emitBookingUpdate(parsePushData(msg.data));
      }
      routeTo(msg);
    },
    [claimMessage, routeTo],
  );

  useEffect(() => {
    if (!isPushSupported) {
      return undefined;
    }
    getInitialPush().then(msg => msg && handleTap(msg));
    return onPushOpened(msg => handleTap(msg, { refresh: true }));
  }, [handleTap]);

  useEffect(() => {
    const target = pendingRoute.current;
    if (
      target &&
      customerId &&
      routeName &&
      !NOT_READY_ROUTES.includes(routeName)
    ) {
      pendingRoute.current = null;
      navigationRef.navigate(target.name, target.params);
    }
  }, [routeName, customerId]);

  // ---- foreground
  useEffect(() => {
    if (!isPushSupported || !customerId) {
      return undefined;
    }
    return onForegroundPush(msg => {
      const parsed = parsePushData(msg?.data);
      // logcat: whether a push reached the open app at all (QA LAT-16)
      console.info(
        '[push] foreground',
        msg?.data?.type || '-',
        'booking',
        parsed.bookingId,
        'on',
        currentRouteName(),
      );
      // a message for the chat on screen shows in it: no banner over it
      if (
        parsed.type === PUSH_TYPES.CHAT_MESSAGE &&
        chatOnScreen(parsed.bookingId)
      ) {
        return;
      }
      emitBookingUpdate(parsed);
      // Home says "No Riders Available" itself: no banner over it
      if (
        parsed.type === PUSH_TYPES.NO_RIDER_FOUND &&
        currentRouteName() === 'HomeScreen'
      ) {
        return;
      }
      const body = formatPushBody(msg?.body, parsed);
      if (!msg?.title && !body) {
        return;
      }
      // Money in or out (a top-up credited, a cash-out paid or returned): the
      // Rider's box, which stays until it is answered, rather than a banner
      // gone in 5 s (the owner, 2026-11-24: both apps show it the same way).
      // A cash-out's result page on screen checks at once and, while it is
      // still checking, says it itself: no box over it (after it stopped,
      // 15 minutes on, the box shows: CSO-19).
      if (MONEY_PUSHES.includes(parsed.type)) {
        const current = navigationRef.isReady()
          ? navigationRef.getCurrentRoute()
          : null;
        // the Wallet on screen reads again now, before View or Dismiss
        // (WAL-11: it kept the old balance and lines)
        const walletRefresh = walletRefreshOnScreen(current, msg?.data);
        if (walletRefresh) {
          navigationRef.dispatch({
            ...CommonActions.setParams(walletRefresh),
            source: current.key,
          });
        }
        if (cashOutPushOnPage(current, msg?.data)) {
          return;
        }
        appAlert(msg?.title || 'Pinoy Ride', body, [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'View', onPress: () => handleTap(msg) },
        ]);
        return;
      }
      setBanner({ ...msg, body });
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBanner(null), BANNER_MS);
    });
  }, [customerId, handleTap]);

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  if (!isPushSupported || !customerId) {
    return null;
  }

  const showOffBanner =
    routeName === 'HomeScreen' &&
    !showPrompt &&
    !offBannerDismissed &&
    !banner &&
    (permission === 'blocked' || permission === 'denied');

  return (
    <>
      {banner && (
        <TouchableOpacity
          testID="push-banner"
          activeOpacity={0.9}
          style={[styles.banner, { top: topInset + 8 }]}
          onPress={() => {
            setBanner(null);
            handleTap(banner);
          }}>
          {banner.title ? (
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {banner.title}
            </Text>
          ) : null}
          {banner.body ? (
            <Text style={styles.bannerBody} numberOfLines={3}>
              {banner.body}
            </Text>
          ) : null}
        </TouchableOpacity>
      )}

      {showOffBanner && (
        <View
          testID="push-off-banner"
          style={[styles.offBanner, { top: topInset + 8 }]}>
          <TouchableOpacity
            style={styles.offBannerTextWrap}
            onPress={handleTurnOn}>
            <Text style={styles.offBannerText}>
              Turn on notifications to know when your rider arrives.{' '}
              <Text style={styles.offBannerLink}>Turn on</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setOffBannerDismissed(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.offBannerClose}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {showPrompt && onHome && (
        <View testID="push-prompt" style={styles.overlay}>
          <View style={styles.container}>
            <Text style={styles.title}>Stay updated</Text>
            <Text style={styles.message}>
              Allow notifications so we can tell you when a rider accepts your
              booking, is on the way, and has arrived, even when the app is
              closed.
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={handleNotNow}
                style={[styles.button, styles.secondary]}>
                <Text style={[styles.buttonText, styles.secondaryText]}>
                  Not now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAllow} style={styles.button}>
                <Text style={styles.buttonText}>Allow</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
};

export default PushNotificationManager;

// Banner follows Home's waiting banner; prompt follows AlertBox.
const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
    zIndex: 1000,
    elevation: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bannerTitle: {
    fontFamily: 'Poppins SemiBold',
    fontSize: 15,
    color: colors.onPrimary,
  },
  bannerBody: {
    fontFamily: 'Poppins Regular',
    fontSize: 13,
    color: colors.onPrimary,
    marginTop: 2,
  },
  offBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#333',
    zIndex: 999,
    elevation: 999,
  },
  offBannerTextWrap: { flex: 1 },
  offBannerText: { fontFamily: 'Poppins Regular', fontSize: 13, color: '#fff' },
  offBannerLink: { fontFamily: 'Poppins SemiBold', color: colors.primary },
  offBannerClose: { color: '#fff', fontSize: 20, paddingLeft: 10 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    elevation: 2000,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
    fontFamily: 'Poppins SemiBold',
    color: colors.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: 'Poppins Regular',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: { fontSize: 14, fontFamily: 'Poppins Medium', color: '#fff' },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryText: { color: colors.primary },
});
