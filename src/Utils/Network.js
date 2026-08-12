import NetInfo from '@react-native-community/netinfo';

// `isInternetReachable` can briefly be `null` right after a state change
// while NetInfo is still probing — treat that as "assume online" so we
// don't flash a false "offline" the instant the listener fires.
const resolveOnline = state =>
  !!state.isConnected && state.isInternetReachable !== false;

/**
 * One-shot connectivity check. Used as a guard right before any action that
 * must NOT be allowed to proceed offline (booking, logout, etc.) and inside
 * Api.js as a fail-fast check before every POST.
 */
export const checkIsOnline = async () => {
  try {
    const state = await NetInfo.fetch();
    return resolveOnline(state);
  } catch (e) {
    // If NetInfo itself errors, don't block the whole app on it — let the
    // actual network request (with its own timeout) be the source of truth.
    return true;
  }
};

/**
 * Subscribe to live connectivity changes. Returns an unsubscribe function.
 */
export const subscribeToNetworkStatus = callback => {
  return NetInfo.addEventListener(state => {
    callback(resolveOnline(state));
  });
};

export default { checkIsOnline, subscribeToNetworkStatus };
