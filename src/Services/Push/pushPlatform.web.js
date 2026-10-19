// Web build (8082/8090 QA): no native push. Every call is a safe no-op so
// @react-native-firebase is never bundled for web.
export const isPushSupported = false;
export const checkPushPermission = async () => 'unavailable';
export const requestPushPermission = async () => 'unavailable';
export const openPushSettings = async () => {};
export const getPushToken = async () => null;
export const deletePushToken = async () => {};
export const onPushTokenRefresh = () => () => {};
export const onForegroundPush = () => () => {};
export const onPushOpened = () => () => {};
export const getInitialPush = async () => null;
export const registerBackgroundPushHandler = () => {};
