// The Google Play build has no wallet (the owner, A-287 item 1 and A-290
// item 3; GOOGLE-PLAY-COMPLIANCE §2.2: no financial features in the store
// build). The app decides it from its own package name, which is native: no
// self-update can change it. The wallet is ON only in the test builds: the
// Develop builds, whose package ends in ".dev" (com.pinoyride.customer.dev,
// com.pinoyride.rider.dev), and the Sandbox builds, ".sandbox" (A-342 /
// A-345: Sandbox is an exact copy of Develop, wallet included). The Play
// names (com.pinoyride.customer, com.pinoyride.rider), an unknown name or an
// error all mean OFF: it fails closed.
//
// Changing this rule turns the wallet on in store builds: only by
// GOOGLE-PLAY-COMPLIANCE §2.5 (the owner's word and the Play declaration
// first), never by a self-update alone.
//
// Every request says which build it comes from (appBuildHeader), and the API
// refuses the money routes to a Play build with 403, reason wallet_off
// (walletOffRefused): never a 401, so nobody is signed out by it.
//
// The same file in both apps (sharedUi.test.mjs). Pure apart from walletOff(),
// which requires react-native-device-info only when called, so node --test
// can load this file.

// the test builds' package suffixes: Develop, Sandbox (appEnvironment.js)
const WALLET_ON_SUFFIXES = ['.dev', '.sandbox'];
const APP_BUILD_HEADER = 'X-App-Build';
const WALLET_OFF_REASON = 'wallet_off';
const WALLET_OFF_MESSAGE =
  'This is not available in this version of Pinoy Ride.';

// true (wallet off) unless the package name is a string ending in ".dev" or
// ".sandbox"
function walletOffFor(bundleId) {
  return !(
    typeof bundleId === 'string' &&
    WALLET_ON_SUFFIXES.some(suffix => bundleId.endsWith(suffix))
  );
}

// read once: the package name does not change while the app runs
let cached = null;

function walletOff() {
  if (cached !== null) {
    return cached;
  }
  try {
    const loaded = require('react-native-device-info');
    const DeviceInfo = loaded?.default ?? loaded;
    cached = walletOffFor(DeviceInfo.getBundleId());
  } catch (error) {
    cached = true;
  }
  return cached;
}

// The header every request carries, from whether the wallet is off.
function appBuildHeaderFor(off) {
  return { [APP_BUILD_HEADER]: off ? 'play' : 'dev' };
}

function appBuildHeader() {
  return appBuildHeaderFor(walletOff());
}

// Whether an answer is the API's "not in this build" (403, reason
// wallet_off). The body is the API's envelope ({ code, message, data }).
function walletOffRefused(status, body) {
  if (Number(status) !== 403 && Number(body?.code) !== 403) {
    return false;
  }
  return (body?.data?.reason ?? body?.reason) === WALLET_OFF_REASON;
}

module.exports = {
  APP_BUILD_HEADER,
  WALLET_OFF_REASON,
  WALLET_OFF_MESSAGE,
  walletOffFor,
  walletOff,
  appBuildHeaderFor,
  appBuildHeader,
  walletOffRefused,
};
